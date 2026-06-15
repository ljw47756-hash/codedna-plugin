import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "..");
const pluginRoot = resolve(serverRoot, "..");

const requiredFiles = [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "README.md",
  "CHANGELOG.md",
  "RELEASE_CHECKLIST.md",
  "docs/INSTALL_WINDOWS.md",
  "docs/TROUBLESHOOTING.md",
  "docs/WORKFLOW_EXAMPLES.md",
  "examples/full-workflow/input-requirement.md",
  "examples/real-project-validation/validation-report.md",
  "mcp-server/package.json",
  "mcp-server/tsconfig.json",
  "mcp-server/src/server.ts"
];

const requiredSkillDirs = [
  "codedna-orchestrator",
  "requirement-capture",
  "reverse-analysis",
  "pairing-review",
  "codex-task-pack",
  "code-review",
  "test-planner",
  "bug-repair",
  "memory-evolution"
];

const missing: string[] = [];
for (const file of requiredFiles) {
  if (!(await exists(join(pluginRoot, file)))) {
    missing.push(file);
  }
}
for (const skill of requiredSkillDirs) {
  const file = join(pluginRoot, "skills", skill, "SKILL.md");
  if (!(await exists(file))) {
    missing.push(`skills/${skill}/SKILL.md`);
  }
}

const plugin = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
const mcp = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
const codednaServer = mcp.codedna ?? mcp.mcp_servers?.codedna ?? mcp.mcpServers?.codedna;
const marketplacePath = join(pluginRoot, ".agents", "plugins", "marketplace.json");
const marketplace = (await exists(marketplacePath)) ? JSON.parse(await readFile(marketplacePath, "utf8")) : null;
const serverSource = await readFile(join(pluginRoot, "mcp-server", "src", "server.ts"), "utf8");

const requiredTools = [
  "codedna_load_memory",
  "codedna_scan_project",
  "codedna_build_project_genome",
  "codedna_run_full_workflow",
  "codedna_parse_requirement",
  "codedna_reverse_analyze",
  "codedna_pair_strands",
  "codedna_generate_task_pack",
  "codedna_generate_guardrails",
  "codedna_validate_changes",
  "codedna_review_diff",
  "codedna_review_output",
  "codedna_generate_repair_task",
  "codedna_propose_memory_update",
  "codedna_confirm_memory_update",
  "codedna_generate_test_plan",
  "codedna_score_outcome",
  "codedna_update_memory"
];

for (const tool of requiredTools) {
  if (!serverSource.includes(tool)) {
    missing.push(`server.ts must register ${tool}`);
  }
}

if (plugin.hooks) {
  missing.push("plugin.json must not include unsupported hooks field");
}
if (plugin.name !== "codedna-plugin") {
  missing.push("plugin.json name must be codedna-plugin");
}
if (plugin.skills !== "./skills/") {
  missing.push("plugin.json skills path must be ./skills/");
}
if (plugin.mcpServers !== "./.mcp.json") {
  missing.push("plugin.json mcpServers path must be ./.mcp.json");
}
if (mcp.mcpServers) {
  missing.push(".mcp.json must use direct server map or mcp_servers, not mcpServers");
}
if (codednaServer?.args?.[0] !== "./mcp-server/dist/server.js") {
  missing.push(".mcp.json codedna server path must be ./mcp-server/dist/server.js");
}
if (codednaServer?.env?.CODEDNA_DATA_DIR === "./data") {
  missing.push(".mcp.json must not depend on CODEDNA_DATA_DIR=./data");
}
if (marketplace && !marketplace.plugins?.some((entry: any) => entry.name === "codedna-plugin" && entry.source?.path === "./plugins/codedna-plugin")) {
  missing.push("marketplace must include codedna-plugin entry pointing to ./plugins/codedna-plugin");
}

if (missing.length > 0) {
  throw new Error(`Release check failed:\n${missing.map((item) => `- ${item}`).join("\n")}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      plugin: plugin.name,
      version: plugin.version,
      required_files: requiredFiles.length,
      required_skills: requiredSkillDirs.length,
      required_tools: requiredTools.length,
      marketplace: marketplace?.name ?? null
    },
    null,
    2
  )
);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
