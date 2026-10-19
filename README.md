# Zof API Contract Check

Compare local OpenAPI 3.0/3.1 JSON contracts or a supported JSON Schema subset. Findings explain endpoint/method removal, required inputs, incompatible request/response types, constraints, media types and authentication changes. The implementation is independently authored and works offline without a Zof account.

<!-- ZOF_RELEASE_INSTALL_START -->
## Install from GitHub source

Requires Node.js 22 or 24, npm, and Git. Filesystem operations require Linux or macOS with Python 3.10 or newer; Windows file operations fail closed. Clone this repository and explicitly prepare its reviewed release dependencies:

```sh
git clone https://github.com/Zof-AI/zof-api-contract-check.git
cd zof-api-contract-check
node scripts/bootstrap.mjs --allow-network
npm ci --ignore-scripts --prefer-offline
npm run build
npm test
```

The bootstrap downloads only the exact `v0.1.0` dependency assets from [GitHub Releases](https://github.com/Zof-AI/zof-api-contract-check/releases), as listed in `scripts/release-dependencies.json`, verifies SHA256 and byte size, and adds them to the npm cache. It does not extract archives, run package scripts, collect application data, or send credentials. Downloads require the explicit flag and follow only HTTPS GitHub asset redirects. Installation then fetches ordinary third-party dependencies from npm. Use a writable npm cache; set `npm_config_cache` consistently for both commands if needed. An unavailable asset, changed hash, or oversized response stops installation.

GitHub source and release artifacts are the initial distribution channel. These instructions do not claim that `@zofai` packages are published on npm or that the VS Code extension is listed in Marketplace.
<!-- ZOF_RELEASE_INSTALL_END -->

## Local installation

Use Node.js 22 or 24. After the source installation above:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm pack --ignore-scripts
```

Use the GitHub source installation above to obtain the exact release dependencies before building or importing the library. The npm package name is an identifier; registry publication remains separate.

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
import { compareContracts, readContract, renderMarkdown } from '@zofai/api-contract-check';
const baseline = await readContract(process.cwd(), 'baseline.json');
const candidate = await readContract(process.cwd(), 'candidate.json');
const report = compareContracts(baseline, candidate, { failOn: 'high' });
console.log(renderMarkdown(report));
```

See [API](docs/API.md), [limitations](docs/LIMITATIONS.md), [security](SECURITY.md), and [release gates](docs/RELEASE.md). No hosted integration or telemetry is implemented.
