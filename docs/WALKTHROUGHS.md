# Three contract-review walkthroughs

These commands use the published `@zof-ai/api-contract-check@0.1.1` package. Start in a new project directory on Linux or macOS with Node.js 22/24 and Python 3.10+:

```sh
npm install --ignore-scripts --save-exact @zof-ai/api-contract-check@0.1.1
```

Every example is synthetic. Exit 1 is the expected result for the deliberately breaking candidate. Run the commands individually so a shell's fail-fast setting does not prevent you from trying the follow-up command. Exit 2 indicates unsupported or invalid input and must not be treated as compatibility.

## 1. A response field changes type

The shipped baseline returns an integer `id` from `GET /items`; the candidate changes that field to a string. Inspect the comparison:

```sh
npx --no-install zof-api-contract-check baseline.json breaking.json --root node_modules/@zof-ai/api-contract-check/examples --kind openapi --markdown
```

Actual finding, exit 1:

```text
- **high** type-incompatible: The accepted or returned value type is incompatible. (GET /items/responses/200/schema/properties/id)
```

A caller expecting an integer now needs review. Keep the original response type for a compatible change, or plan a versioned API migration. The shipped compatible fixture retains that type and adds an optional response field:

```sh
npx --no-install zof-api-contract-check baseline.json compatible.json --root node_modules/@zof-ai/api-contract-check/examples --kind openapi --json
```

Expected: exit 0 and `compatible: true` for supported static checks.

## 2. A query parameter becomes required

A client that previously called `GET /items` without a `region` parameter may fail when the parameter becomes mandatory. Create a tiny local example using the shipped baseline. This snippet creates a new `contract-tutorial` directory and new files; it fails if the directory already exists, so it does not overwrite earlier work.

```sh
node --input-type=module <<'JS'
import { mkdir, writeFile } from 'node:fs/promises';
import { readContract } from '@zof-ai/api-contract-check';

const contract = await readContract(process.cwd(),
  'node_modules/@zof-ai/api-contract-check/examples/baseline.json');
await mkdir('contract-tutorial');
const save = (name, value) => writeFile(`contract-tutorial/${name}`,
  JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
await save('baseline.json', contract);
contract.paths['/items'].get.parameters = [
  { name: 'region', in: 'query', required: true, schema: { type: 'string' } }
];
await save('required-input.json', contract);
contract.paths['/items'].get.parameters[0].required = false;
await save('optional-input.json', contract);
JS

npx --no-install zof-api-contract-check baseline.json required-input.json --root contract-tutorial --kind openapi --markdown
```

Actual finding, exit 1:

```text
- **high** required-parameter-added: A new request parameter is required. (GET /items/parameters/query:region)
```

Allow callers to omit the parameter while migrating them. Compare the optional version created by the same snippet:

```sh
npx --no-install zof-api-contract-check baseline.json optional-input.json --root contract-tutorial --kind openapi --json
```

Expected: exit 0 and `compatible: true`. The service still needs an appropriate default or behavior for omitted input; the checker does not execute that implementation.

The current source tree also includes `examples/required-input.json`. The creation snippet above deliberately works with the existing 0.1.1 package and does not assume that newly added fixture is present in an older npm release.

## 3. Authentication changes during a rollout

The baseline has no declared security requirement. The shipped authentication candidate adds a bearer requirement and its security scheme definition:

```sh
npx --no-install zof-api-contract-check baseline.json authentication.json --root node_modules/@zof-ai/api-contract-check/examples --policy policy.json --kind openapi --markdown
```

Actual findings, exit 1:

```text
- **medium** authentication-changed: Authentication requirements changed. (GET /items)
- **high** authentication-scheme-changed: Security scheme definitions changed. ([location omitted])
```

The shipped policy lowers `authentication-changed` to medium and fails on medium or higher findings. It does not remove the finding or lower the separate scheme-definition finding. The location of that definition is omitted by the report's sanitization rules.

For an intentional authentication rollout, coordinate client migration and decide the release policy explicitly. Do not remove authentication merely to silence a check. If both versions intentionally have the same declaration, the follow-up comparison is:

```sh
npx --no-install zof-api-contract-check authentication.json authentication.json --root node_modules/@zof-ai/api-contract-check/examples --policy policy.json --kind openapi --json
```

Expected: exit 0 and `compatible: true` for supported declarations. This does not prove authentication is implemented correctly or that existing clients can authenticate.

## Use the findings in review

The [PR workflow](CI.md) turns the same exit codes into a CI result for your own contract. Read the [supported subset](LIMITATIONS.md): JSON-only input, unsupported schema composition, and local-reference requirements can prevent analysis. A green comparison covers only the documented static checks, not live API behavior.
