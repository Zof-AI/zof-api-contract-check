import test from "node:test";
import assert from "node:assert/strict";
import {
  compareContracts,
  renderMarkdown,
  readContract,
} from "../dist/index.js";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const contract = () => {
  const schema = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "integer" } },
  };
  return {
    openapi: "3.1.0",
    info: { title: "Synthetic service", version: "1" },
    paths: {
      "/items": {
        get: {
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema } },
            },
          },
        },
      },
    },
  };
};
const clone = (x) => structuredClone(x);
test("unit: closed response objects cannot silently allow new fields", () => {
  const b = contract();
  b.paths["/items"].get.responses["200"].content["application/json"].schema.additionalProperties = false;
  const c = clone(b);
  c.paths["/items"].get.responses["200"].content["application/json"].schema.properties.label = {type:"string"};
  assert.ok(compareContracts(b,c).findings.some(f=>f.id==='additional-properties-changed'));
});
test("unit: compatible endpoint/property additions pass", () => {
  const b = contract(),
    c = clone(b);
  c.paths["/new"] = clone(c.paths["/items"]);
  c.paths["/items"].get.responses["200"].content[
    "application/json"
  ].schema.properties.label = { type: "string" };
  assert.equal(compareContracts(b, c).compatible, true);
});
test("unit: endpoint and method removals identified", () => {
  const b = contract(),
    c = clone(b);
  delete c.paths["/items"];
  assert.equal(compareContracts(b, c).findings[0].id, "endpoint-removed");
  const d = clone(b);
  delete d.paths["/items"].get;
  assert.equal(compareContracts(b, d).findings[0].id, "method-removed");
});
test("unit: request required field and enum narrowing are incompatible", () => {
  const b = {
      type: "object",
      properties: { status: { type: "string", enum: ["a", "b"] } },
    },
    c = clone(b);
  c.required = ["status"];
  c.properties.status.enum = ["a"];
  assert.deepEqual(
    compareContracts(b, c).findings.map((f) => f.id),
    ["required-field-changed", "enum-incompatible"],
  );
});
test("unit: response broadening and lost guarantee are flagged", () => {
  const b = contract(),
    c = clone(b),
    s =
      c.paths["/items"].get.responses["200"].content["application/json"].schema;
  s.properties.id.type = "number";
  s.required = [];
  const ids = compareContracts(b, c).findings.map((f) => f.id);
  assert.ok(ids.includes("required-field-changed"));
  assert.ok(ids.includes("type-incompatible"));
});
test("unit: new required parameter and authentication change", () => {
  const b = contract(),
    c = clone(b);
  c.paths["/items"].get.parameters = [
    { in: "query", name: "page", required: true, schema: { type: "integer" } },
  ];
  c.security = [{ bearer: [] }];
  const ids = compareContracts(b, c).findings.map((f) => f.id);
  assert.ok(ids.includes("authentication-changed"));
  assert.ok(ids.includes("required-parameter-added"));
});
test("unit: configurable policy changes CI threshold and Markdown is meaningful", () => {
  const b = contract(),
    c = clone(b);
  delete c.paths["/items"];
  const r = compareContracts(b, c, { severity: { "endpoint-removed": "low" } });
  assert.equal(r.compatible, true);
  assert.match(renderMarkdown(r), /endpoint-removed/);
  assert.equal(
    compareContracts(b, c, {
      failOn: "low",
      severity: { "endpoint-removed": "low" },
    }).compatible,
    false,
  );
});
test("integration: fragment refs resolve offline", () => {
  const b = {
      type: "object",
      properties: { id: { $ref: "#/$defs/Id" } },
      $defs: { Id: { type: "integer" } },
    },
    c = clone(b);
  c.$defs.Id = { type: "string" };
  assert.ok(
    compareContracts(b, c).findings.some((f) => f.id === "type-incompatible"),
  );
});
test("security: remote, recursive, composed and oversized inputs reject", () => {
  for (const s of [
    { $ref: "https://invalid.example/secret" },
    { $ref: "#" },
    { oneOf: [{ type: "string" }] },
    { description: "x".repeat(4194305) },
  ])
    assert.throws(() => compareContracts(s, s), /Input rejected/);
  const x = {};
  x.properties = { self: x };
  assert.throws(() => compareContracts(x, x), /Input rejected/);
});
test("security: unsafe filesystem paths and symlinks reject without input echo", async () => {
  const root = await mkdtemp(join(tmpdir(), "contract-security-"));
  try {
    await writeFile(join(root, "valid.json"), "{}");
    await symlink(join(root, "valid.json"), join(root, "link.json"));
    for (const path of [
      "../secret",
      "/etc/passwd",
      "https://invalid.example/token",
      "link.json",
    ])
      await assert.rejects(
        readContract(root, path),
        (e) => !e.message.includes(path),
      );
    await writeFile(join(root, "invalid.json"), "{ token-secret:");
    await assert.rejects(
      readContract(root, "invalid.json"),
      (e) => !e.message.includes("token-secret"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("e2e: CLI returns 0, 1 and 2 with structured findings", async () => {
  const root = await mkdtemp(join(tmpdir(), "contract-cli-"));
  try {
    const b = contract(),
      c = clone(b);
    delete c.paths["/items"];
    await writeFile(join(root, "before.json"), JSON.stringify(b));
    await writeFile(join(root, "after.json"), JSON.stringify(c));
    const run = (a) =>
      spawnSync(
        process.execPath,
        ["dist/cli.js", ...a, "--root", root, "--json"],
        { encoding: "utf8" },
      );
    assert.equal(run(["before.json", "before.json"]).status, 0);
    const bad = run(["before.json", "after.json"]);
    assert.equal(bad.status, 1);
    assert.equal(JSON.parse(bad.stdout).findings[0].id, "endpoint-removed");
    assert.equal(run(["../secret", "after.json"]).status, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
