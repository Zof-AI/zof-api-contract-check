import {
  fail,
  record,
  guard,
  parseJson,
  readBounded,
  severity,
  exceeds,
  display,
  markdown,
  type Finding,
  type Severity,
} from "./common.js";
export { SafeInputError, type Finding, type Severity } from "./common.js";
export interface ContractOptions {
  kind?: "openapi" | "json-schema";
  failOn?: Severity;
  severity?: Record<string, Severity>;
}
export interface ContractReport {
  kind: "openapi" | "json-schema";
  compatible: boolean;
  findings: Finding[];
  limitations: string[];
}
const methods = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];
const keys = new Set([
  "type",
  "enum",
  "const",
  "required",
  "properties",
  "items",
  "$ref",
  "$defs",
  "definitions",
  "additionalProperties",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "nullable",
  "description",
  "title",
  "default",
  "examples",
  "example",
  "deprecated",
  "readOnly",
  "writeOnly",
  "xml",
  "externalDocs",
  "$schema",
  "$id",
]);
const limits = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
] as const;
const limitations = [
  "Static JSON OpenAPI 3.0/3.1 and a documented JSON Schema subset only; YAML, composition and remote/file references are rejected.",
  "No runtime implementation, production traffic or behavioral compatibility is verified.",
  "Response property removal is conservatively flagged even when optional; severity policies change CI disposition, not the facts.",
];
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) + ":" + stable((v as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
function strings(v: unknown): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((s) => typeof s !== "string"))
    fail("STRING_ARRAY_REQUIRED");
  return v as string[];
}
function deref(
  root: Record<string, unknown>,
  value: unknown,
  stack: string[] = [],
): Record<string, unknown> {
  const obj = record(value);
  if (obj.$ref === undefined) return obj;
  const ref = obj.$ref;
  if (
    typeof ref !== "string" ||
    (ref !== "#" && !ref.startsWith("#/")) ||
    ref.length > 512
  )
    fail("REFERENCE_UNSUPPORTED");
  if (stack.includes(ref) || stack.length >= 24) fail("REFERENCE_CYCLE");
  if (
    Object.keys(obj).some(
      (k) => !["$ref", "description", "summary"].includes(k),
    )
  )
    fail("REFERENCE_SIBLING_UNSUPPORTED");
  let target: unknown = root;
  for (const segment of ref === "#" ? [] : ref.slice(2).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    const r = record(target);
    if (!Object.hasOwn(r, key)) fail("REFERENCE_MISSING");
    target = r[key];
  }
  return deref(root, target, [...stack, ref]);
}
function checkSchema(
  root: Record<string, unknown>,
  value: unknown,
  refs = new Set<unknown>(),
  depth = 0,
): void {
  if (depth > 32 || refs.has(value)) fail("SCHEMA_RECURSION");
  const next = new Set(refs);
  next.add(value);
  const s = deref(root, value);
  if (next.has(s) && s !== value) fail("SCHEMA_RECURSION");
  for (const k of Object.keys(s))
    if (!keys.has(k)) fail("SCHEMA_KEYWORD_UNSUPPORTED");
  const types =
    s.type === undefined
      ? []
      : typeof s.type === "string"
        ? [s.type]
        : strings(s.type);
  if (
    types.some(
      (t) =>
        ![
          "null",
          "string",
          "integer",
          "number",
          "boolean",
          "array",
          "object",
        ].includes(t),
    )
  )
    fail("SCHEMA_TYPE_INVALID");
  strings(s.required);
  if (s.enum !== undefined && (!Array.isArray(s.enum) || !s.enum.length))
    fail("SCHEMA_ENUM_INVALID");
  for (const k of limits)
    if (
      s[k] !== undefined &&
      (typeof s[k] !== "number" || !Number.isFinite(s[k]))
    )
      fail("SCHEMA_LIMIT_INVALID");
  for (const k of ["pattern", "format"])
    if (s[k] !== undefined && typeof s[k] !== "string")
      fail("SCHEMA_STRING_INVALID");
  for (const k of ["nullable", "readOnly", "writeOnly"])
    if (s[k] !== undefined && typeof s[k] !== "boolean")
      fail("SCHEMA_BOOLEAN_INVALID");
  for (const k of ["properties", "$defs", "definitions"])
    if (s[k] !== undefined)
      for (const v of Object.values(record(s[k])))
        checkSchema(root, v, next, depth + 1);
  if (s.items !== undefined) checkSchema(root, s.items, next, depth + 1);
  if (
    s.additionalProperties !== undefined &&
    typeof s.additionalProperties !== "boolean"
  )
    checkSchema(root, s.additionalProperties, next, depth + 1);
}
function schemaType(s: Record<string, unknown>): string[] {
  const t =
    s.type === undefined
      ? ["any"]
      : typeof s.type === "string"
        ? [s.type]
        : strings(s.type);
  return s.nullable === true ? [...t, "null"] : t;
}
function isSubset(a: string[], b: string[]): boolean {
  return a.every(
    (t) =>
      b.includes(t) ||
      b.includes("any") ||
      (t === "integer" && b.includes("number")),
  );
}
export function compareContracts(
  baseline: unknown,
  candidate: unknown,
  options: ContractOptions = {},
): ContractReport {
  guard(baseline);
  guard(candidate);
  guard(options);
  const b = record(baseline),
    c = record(candidate);
  const kind =
    options.kind ?? (b.openapi !== undefined ? "openapi" : "json-schema");
  if (!["openapi", "json-schema"].includes(kind)) fail("KIND_INVALID");
  const threshold = severity(options.failOn ?? "high");
  const policy = options.severity ?? {};
  record(policy);
  for (const v of Object.values(policy)) severity(v);
  const findings: Finding[] = [];
  const add = (
    id: string,
    message: string,
    path: string,
    level: Severity = "high",
  ) => {
    if (findings.length >= 10000) fail("FINDING_LIMIT");
    findings.push({
      id,
      severity: policy[id] ?? level,
      message,
      path: display(path),
    });
  };
  function compare(
    bs: unknown,
    cs: unknown,
    path: string,
    direction: "request" | "response",
    depth = 0,
  ): void {
    if (depth > 32) fail("SCHEMA_RECURSION");
    const x = deref(b, bs),
      y = deref(c, cs);
    const left = schemaType(x),
      right = schemaType(y);
    if (
      !(direction === "request" ? isSubset(left, right) : isSubset(right, left))
    )
      add(
        "type-incompatible",
        "The accepted or returned value type is incompatible.",
        path,
      );
    const requiredB = strings(x.required),
      requiredC = strings(y.required);
    for (const prop of direction === "request"
      ? requiredC.filter((k) => !requiredB.includes(k))
      : requiredB.filter((k) => !requiredC.includes(k)))
      add(
        "required-field-changed",
        direction === "request"
          ? "A request property became required."
          : "A response property is no longer guaranteed.",
        path + "/properties/" + prop,
      );
    const en = (s: Record<string, unknown>) =>
      s.const !== undefined
        ? [s.const]
        : Array.isArray(s.enum)
          ? s.enum
          : undefined;
    const eb = en(x),
      ec = en(y);
    if (
      direction === "request"
        ? ec &&
          (!eb || eb.some((v) => !ec.some((w) => stable(v) === stable(w))))
        : eb &&
          (!ec || ec.some((v) => !eb.some((w) => stable(v) === stable(w))))
    )
      add("enum-incompatible", "Allowed values changed incompatibly.", path);
    for (const k of limits) {
      const old = x[k] as number | undefined,
        now = y[k] as number | undefined;
      const min = k.includes("inimum") || k.startsWith("min");
      const tight =
        now !== undefined &&
        (old === undefined || (min ? now > old : now < old));
      const loose =
        old !== undefined &&
        (now === undefined || (min ? now < old : now > old));
      if (direction === "request" ? tight : loose)
        add(
          "constraint-incompatible",
          "A value constraint changed incompatibly.",
          path + "/" + k,
        );
    }
    for (const k of ["pattern", "format", "readOnly", "writeOnly"])
      if (x[k] !== y[k])
        add(
          "constraint-changed",
          "A format, pattern or visibility constraint changed.",
          path + "/" + k,
        );
    const xp = x.properties === undefined ? {} : record(x.properties),
      yp = y.properties === undefined ? {} : record(y.properties);
    for (const key of Object.keys(xp).sort()) {
      if (!Object.hasOwn(yp, key)) {
        if (direction === "response" || y.additionalProperties === false)
          add(
            "property-removed",
            "A previously described property was removed.",
            path + "/properties/" + key,
          );
      } else
        compare(
          xp[key],
          yp[key],
          path + "/properties/" + key,
          direction,
          depth + 1,
        );
    }
    if (
      direction === "request" &&
      y.additionalProperties === false &&
      x.additionalProperties !== false
    )
      add(
        "additional-properties-restricted",
        "Requests no longer permit additional properties.",
        path,
      );
    if (
      direction === "response" &&
      x.additionalProperties === false &&
      (y.additionalProperties !== false || Object.keys(yp).some(k => !Object.hasOwn(xp, k)))
    ) add("additional-properties-changed", "Responses may include properties previously forbidden by the contract.", path);
    if (
      typeof x.additionalProperties === "object" ||
      typeof y.additionalProperties === "object"
    ) {
      if (
        typeof x.additionalProperties === "object" &&
        typeof y.additionalProperties === "object"
      )
        compare(
          x.additionalProperties,
          y.additionalProperties,
          path + "/additionalProperties",
          direction,
          depth + 1,
        );
      else if (
        direction === "request"
          ? typeof y.additionalProperties === "object"
          : typeof x.additionalProperties === "object"
      )
        add(
          "additional-properties-changed",
          "Additional property constraints changed incompatibly.",
          path,
        );
    }
    if (x.items !== undefined && y.items !== undefined)
      compare(x.items, y.items, path + "/items", direction, depth + 1);
    else if (
      direction === "request"
        ? x.items === undefined && y.items !== undefined
        : x.items !== undefined && y.items === undefined
    )
      add(
        "items-changed",
        "Array item constraints changed incompatibly.",
        path,
      );
  }
  if (kind === "json-schema") {
    checkSchema(b, b);
    checkSchema(c, c);
    compare(b, c, "#", "request");
  } else {
    for (const root of [b, c]) {
      if (
        typeof root.openapi !== "string" ||
        !/^3\.(0|1)\.\d+$/.test(root.openapi)
      )
        fail("OPENAPI_VERSION_UNSUPPORTED");
      if (root.paths === undefined) fail("OPENAPI_PATHS_REQUIRED");
      record(root.paths);
      const scan = (v: unknown, depth = 0): void => {
        if (depth > 40) fail("INPUT_COMPLEXITY");
        if (!v || typeof v !== "object") return;
        if (Array.isArray(v)) {
          for (const x of v) scan(x, depth + 1);
          return;
        }
        const r = record(v);
        if (r.$ref !== undefined) deref(root, r);
        for (const [k, x] of Object.entries(r)) {
          if (k === "schema") checkSchema(root, x);
          else if (k === "schemas")
            for (const s of Object.values(record(x))) checkSchema(root, s);
          else scan(x, depth + 1);
        }
      };
      scan(root);
    }
    const bp = record(b.paths),
      cp = record(c.paths);
    function security(
      root: Record<string, unknown>,
      op: Record<string, unknown>,
    ): unknown {
      const v = op.security ?? root.security ?? [];
      if (!Array.isArray(v)) fail("SECURITY_INVALID");
      return v.map((x) => {
        const r = record(x);
        for (const a of Object.values(r)) strings(a);
        return r;
      });
    }
    function parameters(
      root: Record<string, unknown>,
      path: Record<string, unknown>,
      op: Record<string, unknown>,
    ): Map<string, Record<string, unknown>> {
      const out = new Map<string, Record<string, unknown>>();
      for (const group of [path.parameters ?? [], op.parameters ?? []]) {
        if (!Array.isArray(group)) fail("PARAMETERS_INVALID");
        for (const raw of group) {
          const p = deref(root, raw);
          if (
            typeof p.name !== "string" ||
            !["query", "header", "path", "cookie"].includes(p.in as string)
          )
            fail("PARAMETER_INVALID");
          if (p.content !== undefined || p.schema === undefined)
            fail("PARAMETER_SCHEMA_REQUIRED");
          if (p.required !== undefined && typeof p.required !== "boolean")
            fail("PARAMETER_INVALID");
          out.set(p.in + ":" + p.name, p);
        }
      }
      return out;
    }
    function media(
      old: Record<string, unknown>,
      now: Record<string, unknown>,
      path: string,
      direction: "request" | "response",
    ): void {
      const oc = old.content === undefined ? {} : record(old.content),
        nc = now.content === undefined ? {} : record(now.content);
      for (const type of Object.keys(oc)) {
        if (!Object.hasOwn(nc, type)) {
          add(
            "media-type-removed",
            "A documented media type was removed.",
            path,
          );
          continue;
        }
        const x = record(oc[type]),
          y = record(nc[type]);
        if (x.schema !== undefined && y.schema !== undefined)
          compare(x.schema, y.schema, path + "/schema", direction);
        else if (x.schema !== y.schema)
          add(
            "schema-presence-changed",
            "A documented schema was added or removed; review compatibility.",
            path,
          );
      }
    }
    for (const path of Object.keys(bp).sort()) {
      if (!path.startsWith("/") || path.length > 512)
        fail("OPENAPI_PATH_INVALID");
      if (!Object.hasOwn(cp, path)) {
        add("endpoint-removed", "A documented endpoint was removed.", path);
        continue;
      }
      const old = deref(b, bp[path]),
        now = deref(c, cp[path]);
      for (const method of methods) {
        if (old[method] === undefined) continue;
        const loc = method.toUpperCase() + " " + path;
        if (now[method] === undefined) {
          add("method-removed", "An HTTP method was removed.", loc);
          continue;
        }
        const x = record(old[method]),
          y = record(now[method]);
        if (stable(security(b, x)) !== stable(security(c, y)))
          add(
            "authentication-changed",
            "Authentication requirements changed.",
            loc,
          );
        const xp = parameters(b, old, x),
          yp = parameters(c, now, y);
        for (const [key, p] of yp) {
          const before = xp.get(key);
          if (
            (p.required === true || p.in === "path") &&
            (!before || (before.required !== true && before.in !== "path"))
          )
            add(
              "required-parameter-added",
              "A new request parameter is required.",
              loc + "/parameters/" + key,
            );
          if (before)
            compare(
              before.schema,
              p.schema,
              loc + "/parameters/" + key,
              "request",
            );
        }
        for (const [key, p] of xp)
          if (!yp.has(key))
            add(
              "parameter-removed",
              "A previously documented request parameter was removed.",
              loc + "/parameters/" + key,
              "medium",
            );
        if (y.requestBody !== undefined) {
          const nr = deref(c, y.requestBody);
          if (x.requestBody === undefined) {
            if (nr.required === true)
              add(
                "request-body-required",
                "A request body became required.",
                loc,
              );
          } else {
            const br = deref(b, x.requestBody);
            if (nr.required === true && br.required !== true)
              add(
                "request-body-required",
                "A request body became required.",
                loc,
              );
            media(br, nr, loc + "/requestBody", "request");
          }
        } else if (x.requestBody !== undefined)
          add(
            "request-body-removed",
            "A documented request body was removed.",
            loc,
          );
        if (x.responses === undefined || y.responses === undefined)
          fail("RESPONSES_REQUIRED");
        const xr = record(x.responses),
          yr = record(y.responses);
        for (const status of Object.keys(xr)) {
          if (!Object.hasOwn(yr, status)) {
            add(
              "response-removed",
              "A documented response status was removed.",
              loc + "/responses/" + status,
            );
            continue;
          }
          media(
            deref(b, xr[status]),
            deref(c, yr[status]),
            loc + "/responses/" + status,
            "response",
          );
        }
      }
    }
    const bs = record(
        (b.components as Record<string, unknown> | undefined)
          ?.securitySchemes ?? {},
      ),
      cs = record(
        (c.components as Record<string, unknown> | undefined)
          ?.securitySchemes ?? {},
      );
    if (stable(bs) !== stable(cs))
      add(
        "authentication-scheme-changed",
        "Security scheme definitions changed.",
        "#/components/securitySchemes",
      );
  }
  return {
    kind,
    compatible: !exceeds(findings, threshold),
    findings,
    limitations: [...limitations],
  };
}
export const readContract = async (
  root: string,
  path: string,
): Promise<unknown> => parseJson(await readBounded(root, path));
export const renderMarkdown = (report: ContractReport): string =>
  markdown("API compatibility report", report.findings, report.limitations);
