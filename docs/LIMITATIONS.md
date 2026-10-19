# Supported scope and limitations

Only JSON OpenAPI 3.0/3.1 and JSON Schema object schemas are accepted. YAML is not parsed. References must be local JSON Pointer fragments in the same document. Remote references, other local files, cycles, `$ref` siblings other than descriptions, boolean schemas, composition (`allOf`, `oneOf`, `anyOf`, `not`), conditionals, tuple schemas and unrecognized schema keywords are rejected, returning exit 2.

Supported schema checks include type/nullable, enum/const, required, properties, homogeneous items, additionalProperties, numeric bounds, length/item bounds, pattern and format changes, and readOnly/writeOnly changes. The checker does not evaluate regular expressions or validate instance data. OpenAPI parameter schemas are required; content-based parameters are rejected. OpenAPI 3.0 boolean exclusive bounds are outside this subset.

OpenAPI response-property removal is conservatively flagged even if the property was optional. Response headers, links, callbacks, webhooks, discriminator behavior, pagination semantics, authorization semantics, implementation behavior and external services are not verified. Security scheme definition changes are reported even if unused. Reports compare supported declared contracts, and do not certify full OpenAPI validity.

Source errors never quote input. Findings retain sanitized specification locations; avoid placing secrets in contract names or paths. No network requests, embedded code execution or artifact retrieval occurs. Hosted capabilities are blocked pending an approved public contract and authorized live acceptance tests.
