# Zof API Contract Check

Compare local OpenAPI 3.0/3.1 JSON contracts or a supported JSON Schema subset. Findings explain endpoint/method removal, required inputs, incompatible request/response types, constraints, media types and authentication changes. The implementation is independently authored and works offline without a Zof account.

<!-- ZOF_NPM_INSTALL_START -->
## Install from npm

Use Node.js 22 or 24 and npm. File-based operations require Linux or macOS with Python 3.10 or newer; Windows file operations fail closed. In a new project directory, install the version used by this guide:

```sh
npm install --ignore-scripts --save-exact @zof-ai/api-contract-check@0.1.1
npx --no-install zof-api-contract-check --help
```

The package includes compiled JavaScript, TypeScript declarations and its runtime dependencies. No source build, Zof account or repository upload is required. `--ignore-scripts` disables installation lifecycle scripts; `--no-install` keeps the example commands from downloading another package.

Confirm the public ESM entry point; this prints `function`:

```sh
node --input-type=module -e "import('@zof-ai/api-contract-check').then(api => console.log(typeof api.compareContracts))"
```

Run a packaged example from the same directory:

```sh
npx --no-install zof-api-contract-check baseline.json compatible.json --root node_modules/@zof-ai/api-contract-check/examples --kind openapi --json
```

The compatible OpenAPI example reports `compatible: true`; the breaking example described below exits 1.

Package: [@zof-ai/api-contract-check](https://www.npmjs.com/package/@zof-ai/api-contract-check). The source-checkout instructions and three additional workflows follow.
<!-- ZOF_NPM_INSTALL_END -->

<!-- ZOF_RELEASE_INSTALL_START -->
## Install from GitHub source

Requires Node.js 22 or 24, npm, and Git. Filesystem operations require Linux or macOS with Python 3.10 or newer; Windows file operations fail closed. Clone this repository and explicitly prepare its reviewed release dependencies:

```sh
git clone --branch v0.1.1 --depth 1 https://github.com/Zof-AI/zof-api-contract-check.git
cd zof-api-contract-check
node scripts/bootstrap.mjs --allow-network
npm ci --ignore-scripts --prefer-offline
npm run build
npm test
```

The bootstrap downloads only the exact versioned dependency assets from [GitHub Releases](https://github.com/Zof-AI/zof-api-contract-check/releases), as listed in `scripts/release-dependencies.json`, verifies SHA256 and byte size, and adds them to the npm cache. It does not extract archives, run package scripts, collect application data, or send credentials. Downloads require the explicit flag and follow only HTTPS GitHub asset redirects. Installation then fetches ordinary third-party dependencies from npm. Use a writable npm cache; set `npm_config_cache` consistently for both commands if needed. An unavailable asset, changed hash, or oversized response stops installation.

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
import { compareContracts, readContract, renderMarkdown } from '@zof-ai/api-contract-check';
const baseline = await readContract(process.cwd(), 'baseline.json');
const candidate = await readContract(process.cwd(), 'candidate.json');
const report = compareContracts(baseline, candidate, { failOn: 'high' });
console.log(renderMarkdown(report));
```

See [API](docs/API.md), [limitations](docs/LIMITATIONS.md), [security](SECURITY.md), and [release gates](docs/RELEASE.md). No hosted integration or telemetry is implemented.
