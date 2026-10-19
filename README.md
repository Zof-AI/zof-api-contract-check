# Zof API Contract Check

Compare local OpenAPI 3.0/3.1 JSON contracts or a supported JSON Schema subset. Findings explain endpoint/method removal, required inputs, incompatible request/response types, constraints, media types and authentication changes. The implementation is independently authored and works offline without a Zof account.

## Local installation

Use Node.js 22 or 24. From this candidate repository:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm pack --ignore-scripts
```

Install the resulting tarball in a separate project with `npm install /absolute/path/to/package.tgz`. The candidate package name is `@zof-ai/api-contract-check`; public registry installation and intended GitHub URLs remain unverified until publication approval. The proposed Apache-2.0 license requires owner and legal approval.

## Three examples

Run from the repository root after building, or substitute the installed `zof-api-contract-check` executable.

```sh
# Compatible optional response field: exit 0
node dist/cli.js examples/baseline.json examples/compatible.json --json
# Response integer changed to string: exit 1
node dist/cli.js examples/baseline.json examples/breaking.json --markdown
# Authentication rollout review with explicit policy: exit 1
node dist/cli.js examples/baseline.json examples/authentication.json --policy examples/policy.json --json
```

Pass `--root DIR` to set the only readable workspace root. For standalone JSON Schema comparisons use `--kind json-schema`; this compares accepted inputs, so narrower candidate constraints are incompatible. Default reports are Markdown. Exit codes: 0 completed below the policy threshold, 1 findings at or above it, 2 invalid input or unsupported/incomplete analysis. All findings remain in the report when policy lowers severity.

## Library

```js
import { compareContracts, readContract, renderMarkdown } from '@zof-ai/api-contract-check';
const baseline = await readContract(process.cwd(), 'baseline.json');
const candidate = await readContract(process.cwd(), 'candidate.json');
const report = compareContracts(baseline, candidate, { failOn: 'high' });
console.log(renderMarkdown(report));
```

See [API](docs/API.md), [limitations](docs/LIMITATIONS.md), [security](SECURITY.md), and [release gates](docs/RELEASE.md). No hosted integration or telemetry is implemented.
