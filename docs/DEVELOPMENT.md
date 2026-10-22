# Source installation and development

<!-- ZOF_RELEASE_INSTALL_START -->
## Install from GitHub source

Requires Node.js 22 or 24, npm, and Git. Filesystem operations require Linux or macOS with Python 3.10 or newer; Windows file operations fail closed. Clone the published version and explicitly prepare its reviewed release dependencies:

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

## Develop and validate

After preparing the checkout, run:

```sh
npm run check
npm run test:package
npm pack --ignore-scripts
```

`check` builds with strict TypeScript checking and runs the repository's node:test suite. The packaged consumer check installs a local package with its checked dependency and exercises the public entry point. It is separate from anonymous public-registry installation acceptance.

The source-checkout CLI is `node dist/cli.js`; the installed equivalent is `zof-api-contract-check`. For example:

```sh
node dist/cli.js examples/baseline.json examples/breaking.json --markdown
```

The deliberately breaking example exits 1. See [walkthroughs](WALKTHROUGHS.md) for the interpretation and [CONTRIBUTING.md](../CONTRIBUTING.md) for review expectations. Publishing a new package version follows the separate [release process](RELEASE.md).
