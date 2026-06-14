import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCodeDnaMcpE2E } from "./e2e.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "..");
const pluginRoot = resolve(serverRoot, "..");
const reportDir = join(pluginRoot, "examples", "real-project-validation");
const reportPath = join(reportDir, "validation-report.md");

const result = await runCodeDnaMcpE2E({
  dataRoot: join(pluginRoot, "data"),
  exampleDir: reportDir,
  projectPath: pluginRoot,
  writeExampleOutputs: true
});

await mkdir(reportDir, { recursive: true });
await writeFile(
  reportPath,
  `# CodeDNA Real Project Validation Report

## Project

${pluginRoot}

## Request

Add a login page for the existing app with a dark minimal visual style. Support email login and verification-code login. Do not modify unrelated files. Preserve the existing project structure. Run the available test or build command after completion and summarize the verification result.

## MCP Server Command

\`\`\`text
${result.mcp_server_command}
\`\`\`

## Tools Called

${result.tools_called.map((tool) => `- ${tool}`).join("\n")}

## Tools Available

${result.tools_available.map((tool) => `- ${tool}`).join("\n")}

## Pairing Result

- Pairing Score: ${result.pairing_score}
- Execution Level: ${result.execution_level}
- Ready For Codex: ${result.ready_for_codex ? "yes" : "no"}

## Generated Artifacts

${Object.entries(result.artifacts).map(([name, path]) => `- ${name}: ${path}`).join("\n")}

## Generated Example Files

${Object.entries(result.generated_examples).map(([name, path]) => `- ${name}: ${path}`).join("\n")}

## Memory Update

The workflow called \`codedna_update_memory\` and verified the returned merged memory.

## Codex App Installation Note

The local WindowsApps Codex executable returned \`Access is denied\` when called directly from PowerShell in this environment. The plugin files, manifest, marketplace entry, MCP stdio server, and real MCP client workflow were validated locally. Use the manual Codex App installation flow in \`docs/INSTALL_WINDOWS.md\` when the CLI entry point is not executable.
`,
  "utf8"
);

console.log(JSON.stringify({ ...result, validation_report: reportPath }, null, 2));
