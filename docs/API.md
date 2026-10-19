# API and compatibility policy

`compareContracts(baseline, candidate, options?)` accepts JSON objects and returns `{kind, compatible, findings, limitations}`. `kind` is `openapi` or `json-schema`; omitted kind detects OpenAPI from the baseline. Options accept `failOn` (default `high`) and a `severity` map keyed by finding ID. Severities in ascending order are `info`, `low`, `medium`, `high`, `critical`. Findings contain `id`, `severity`, fixed explanatory `message`, and a sanitized location `path`.

`readContract(root, relativePath)` reads bounded UTF-8 JSON below an explicit root. `renderMarkdown(report)` renders a report. `SafeInputError` has a fixed safe `code` and message. Limits: 4 MiB per file, 100,000 JSON nodes, depth 48, schema depth 32, and reference chain length 24.

Finding IDs: endpoint-removed, method-removed, required-parameter-added, parameter-removed, request-body-required, request-body-removed, response-removed, media-type-removed, schema-presence-changed, authentication-changed, authentication-scheme-changed, type-incompatible, required-field-changed, enum-incompatible, constraint-incompatible, constraint-changed, property-removed, additional-properties-restricted, additional-properties-changed and items-changed. Most default to high; removed request parameters default to medium.

Requests use input contravariance: newly required fields, narrower types/enums and tighter bounds may reject existing callers. Responses use output covariance: broader types/enums, weaker guaranteed fields and loosened bounds may violate consumer expectations. Integer is a subset of number. Authentication changes and format/pattern changes conservatively require review. Documentation-only changes are ignored.

This 0.1.0 API is the initial public candidate. Breaking changes require a documented version change. `compatible` means below the configured threshold for completed supported static checks, never proof of runtime compatibility.
