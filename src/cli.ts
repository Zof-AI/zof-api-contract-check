#!/usr/bin/env node
import {
  compareContracts,
  readContract,
  renderMarkdown,
  type ContractOptions,
} from "./index.js";
import { cliError, fail, record } from "./common.js";
try {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "zof-api-contract-check BASELINE.json CANDIDATE.json [--root DIR] [--kind openapi|json-schema] [--policy POLICY.json] [--json|--markdown]\nOffline JSON contracts. Exit 0: completed below threshold; 1: findings; 2: invalid/unsupported input.",
    );
  } else if (args.includes("--version")) console.log("0.1.0");
  else {
    let root = process.cwd(),
      format = "markdown",
      policy: string | undefined,
      kind: ContractOptions["kind"];
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--root") {
        root = args[++i] ?? fail("ARGUMENT_REQUIRED");
      } else if (a === "--policy")
        policy = args[++i] ?? fail("ARGUMENT_REQUIRED");
      else if (a === "--kind") kind = args[++i] as ContractOptions["kind"];
      else if (a === "--json") format = "json";
      else if (a === "--markdown") format = "markdown";
      else if (a.startsWith("-")) fail("ARGUMENT_UNKNOWN");
      else files.push(a);
    }
    if (files.length !== 2) fail("TWO_FILES_REQUIRED");
    const options = policy
      ? (record(await readContract(root, policy)) as ContractOptions)
      : {};
    if (kind) options.kind = kind;
    const result = compareContracts(
      await readContract(root, files[0]),
      await readContract(root, files[1]),
      options,
    );
    console.log(
      format === "json"
        ? JSON.stringify(result, null, 2)
        : renderMarkdown(result),
    );
    process.exitCode = result.compatible ? 0 : 1;
  }
} catch (error) {
  cliError(error);
}
