# Check API compatibility in pull requests

Copy [examples/github-actions/api-contract.yml](../examples/github-actions/api-contract.yml) into your repository as `.github/workflows/api-contract.yml`. The complete workflow installs the published `@zof-ai/api-contract-check@0.1.1` package separately from your application and compares the contract at the PR's exact base and head commits.

## Configure your contract path

The example expects a tracked `openapi.json` at the repository root in both revisions. Change the two arguments in its final step if your contract is elsewhere. For `api/public.json`, use:

```sh
node "$RUNNER_TEMP/zof-contract-tool/node_modules/@zof-ai/api-contract-check/dist/cli.js" \
  contract-base/api/public.json contract-head/api/public.json \
  --root "$GITHUB_WORKSPACE" --kind openapi --markdown
```

Keep the `contract-base/` and `contract-head/` prefixes. Use static, quoted arguments for paths containing spaces; do not interpolate PR titles, branch names, issue text, or other user input into shell commands. The checker constrains reads to the checkout workspace and rejects escaping or symlink inputs.

Use a JSON OpenAPI 3.0/3.1 contract within the [supported subset](LIMITATIONS.md). YAML, schema composition, external references, and missing files fail with exit 2. A new API with no baseline needs an explicit baseline decision; this workflow deliberately does not invent an empty contract or count absence as a pass.

## What happens on a pull request

1. A GitHub-hosted Ubuntu runner installs Node 22 and checks Python 3.10+.
2. The published checker is installed under runner temporary storage with lifecycle scripts disabled, before any application checkout.
3. Two separate checkouts select the exact base and head commit SHAs from the PR event. They do not persist checkout credentials and do not initialize submodules or Git LFS.
4. The installed CLI compares the two contract files. Its finding report appears in the workflow log. Exit 1 (findings) and exit 2 (invalid or incomplete analysis) both fail the job.

The workflow does not generate an OpenAPI document by running application code. Commit the contract to Git, or prepare it through a separate trusted process. It compares declarations, not implementations or live endpoints. GitHub must be able to fetch both commits; a checkout failure also fails the job.

## Permissions and branch protection

The workflow uses `contents: read`, SHA-pinned actions, a ten-minute timeout, and a GitHub-hosted runner. It does not use `pull_request_target`, application package scripts, a Zof account, extra secrets, or hosted Zof requests. Package installation and Git checkout use the network; the contract comparison runs offline. The checker is installed outside the checked-out application's dependency tree, and it never executes checked-out source code.

The final comparison has no `continue-on-error` or `|| true`. Preserve that behavior. After a real run succeeds, a repository maintainer can make **API contract compatibility** a required branch-protection check. Review workflow changes as code and retain the minimum token permissions; there is no automatic publishing or merge step.

For an initial trial, observe the check on a PR with a known compatible change and one with a deliberately breaking synthetic change before requiring it for your team. Local fixture checks verify the CLI's exit behavior; only completed workflow runs in your repository establish hosted CI acceptance for this workflow.

This workflow invokes the API Contract Check CLI directly. The separate `Zof-AI/zof-github-action` provides generic static source checks and does not perform this contract comparison.
