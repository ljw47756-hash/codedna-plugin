import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "..");
const pluginRoot = resolve(serverRoot, "..");

const coreWorkflowToolNames = [
  "codedna_load_memory",
  "codedna_scan_project",
  "codedna_parse_requirement",
  "codedna_reverse_analyze",
  "codedna_pair_strands",
  "codedna_generate_task_pack",
  "codedna_review_output",
  "codedna_update_memory"
] as const;

const requiredToolNames = [
  ...coreWorkflowToolNames,
  "codedna_build_project_genome",
  "codedna_run_full_workflow",
  "codedna_review_diff",
  "codedna_generate_guardrails",
  "codedna_validate_changes",
  "codedna_generate_repair_task",
  "codedna_propose_memory_update",
  "codedna_confirm_memory_update",
  "codedna_generate_test_plan",
  "codedna_score_outcome"
] as const;

export interface CodeDnaMcpE2EOptions {
  dataRoot?: string;
  exampleDir?: string;
  projectPath?: string;
  writeExampleOutputs?: boolean;
}

export interface CodeDnaMcpE2EResult {
  ok: true;
  mcp_server_command: string;
  tools_called: string[];
  tools_available: string[];
  pairing_score: number;
  execution_level: string;
  ready_for_codex: boolean;
  artifacts: Record<string, string>;
  generated_examples: Record<string, string>;
  verified_fields: string[];
}

export async function runCodeDnaMcpE2E(options: CodeDnaMcpE2EOptions = {}): Promise<CodeDnaMcpE2EResult> {
  const dataRoot = resolve(options.dataRoot ?? join(pluginRoot, "data"));
  const exampleDir = resolve(options.exampleDir ?? join(pluginRoot, "examples", "full-workflow"));
  const projectPath = resolve(options.projectPath ?? pluginRoot);
  const mcpConfig = await readJson(join(pluginRoot, ".mcp.json"));
  const serverConfig = readCodeDnaServerConfig(mcpConfig);
  ensure(serverConfig, "Missing codedna MCP server in .mcp.json.");

  const command = String(serverConfig.command);
  const args = Array.isArray(serverConfig.args) ? serverConfig.args.map(String) : [];
  const transport = new StdioClientTransport({
    command,
    args,
    cwd: pluginRoot,
    env: {
      ...stringEnv(process.env),
      ...stringEnv(serverConfig.env ?? {}),
      CODEDNA_DATA_DIR: dataRoot
    },
    stderr: "pipe"
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const client = new Client({ name: "codedna-e2e-client", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const available = new Set(tools.tools.map((tool) => tool.name));
    for (const name of requiredToolNames) {
      ensure(available.has(name), `MCP server did not expose required tool: ${name}`);
    }

    const loadMemory = await callTool<Record<string, unknown>>(client, "codedna_load_memory", {});
    ensureObjectPath(loadMemory, ["memory", "common_project_rules"]);

    const scan = await callTool<Record<string, any>>(client, "codedna_scan_project", {
      project_path: projectPath,
      max_depth: 3
    });
    ensureObjectPath(scan, ["project_profile", "language"]);

    const requirementText = await readFile(join(pluginRoot, "examples", "full-workflow", "input-requirement.md"), "utf8");
    const parsed = await callTool<Record<string, any>>(client, "codedna_parse_requirement", {
      request: requirementText,
      project_profile: scan.project_profile
    });
    ensureObjectPath(parsed, ["requirement_strand", "core_goal"]);

    const analysis = await callTool<Record<string, any>>(client, "codedna_reverse_analyze", {
      requirement_strand: parsed.requirement_strand,
      project_profile: scan.project_profile
    });
    ensureObjectPath(analysis, ["analysis_strand", "risks"]);

    const pairing = await callTool<Record<string, any>>(client, "codedna_pair_strands", {
      requirement_strand: parsed.requirement_strand,
      analysis_strand: analysis.analysis_strand
    });
    const pairingResult = pairing.pairing_result;
    ensure(typeof pairingResult.pairing_score === "number", "pairing_score must be numeric.");
    ensureExecutionLevel(pairingResult.pairing_score, pairingResult.execution_level, pairingResult.ready_for_codex);

    const taskPack = await callTool<Record<string, any>>(client, "codedna_generate_task_pack", {
      requirement_strand: parsed.requirement_strand,
      analysis_strand: analysis.analysis_strand,
      pairing_result: pairingResult,
      project_profile: scan.project_profile
    });
    ensureObjectPath(taskPack, ["codex_task_pack", "markdown"]);

    const sampleOutput = await readFile(join(pluginRoot, "mcp-server", "test-inputs", "sample-codex-output.md"), "utf8");
    const review = await callTool<Record<string, any>>(client, "codedna_review_output", {
      requirement_strand: parsed.requirement_strand,
      analysis_strand: analysis.analysis_strand,
      project_profile: scan.project_profile,
      codex_output: sampleOutput
    });
    ensureObjectPath(review, ["review_report", "markdown"]);

    const memoryUpdate = await callTool<Record<string, any>>(client, "codedna_update_memory", {
      memory_patch: {
        common_project_rules: ["Use MCP client smoke before publishing CodeDNA updates."]
      },
      event: {
        type: "mcp_client_e2e",
        result: pairingResult.ready_for_codex ? "ready" : "blocked"
      },
      successful_pattern: {
        name: "MCP client e2e",
        summary: "CodeDNA tools were called through a real MCP stdio client."
      }
    });
    ensureObjectPath(memoryUpdate, ["memory", "common_project_rules"]);

    const artifacts = {
      project_profile: String(scan.artifact_path ?? ""),
      requirement: String(parsed.artifact_path ?? ""),
      analysis: String(analysis.artifact_path ?? ""),
      pairing: String(pairing.artifact_path ?? ""),
      task_pack: String(taskPack.artifact_path ?? ""),
      review: String(review.artifact_path ?? "")
    };
    for (const [name, artifactPath] of Object.entries(artifacts)) {
      ensure(artifactPath.length > 0, `Missing artifact path for ${name}.`);
      await assertFileExists(artifactPath);
    }

    const generatedExamples: Record<string, string> = {};
    if (options.writeExampleOutputs !== false) {
      await mkdir(exampleDir, { recursive: true });
      generatedExamples.task_pack = join(exampleDir, "generated-task-pack.md");
      generatedExamples.review_report = join(exampleDir, "generated-review-report.md");
      await writeFile(generatedExamples.task_pack, `${String(taskPack.codex_task_pack.markdown).trimEnd()}\n`, "utf8");
      await writeFile(generatedExamples.review_report, `${String(review.review_report.markdown).trimEnd()}\n`, "utf8");
      await assertFileExists(generatedExamples.task_pack);
      await assertFileExists(generatedExamples.review_report);
    }

    return {
      ok: true,
      mcp_server_command: `${command} ${args.join(" ")}`.trim(),
      tools_called: [...coreWorkflowToolNames],
      tools_available: [...requiredToolNames],
      pairing_score: pairingResult.pairing_score,
      execution_level: pairingResult.execution_level,
      ready_for_codex: pairingResult.ready_for_codex,
      artifacts,
      generated_examples: generatedExamples,
      verified_fields: [
        "tools exposed",
        "structuredContent parsed",
        "pairing score rule",
        "task pack artifact exists",
        "review report artifact exists",
        "memory update returned merged memory"
      ]
    };
  } catch (error) {
    const detail = stderr.trim() ? `\nServer stderr:\n${stderr}` : "";
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`);
  } finally {
    await client.close();
  }
}

async function callTool<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  if ("isError" in result && result.isError) {
    throw new Error(`MCP tool ${name} returned an error: ${JSON.stringify(result)}`);
  }
  if ("structuredContent" in result && result.structuredContent) {
    return result.structuredContent as T;
  }
  const text = "content" in result ? result.content.find((item) => item.type === "text")?.text : "";
  ensure(text, `MCP tool ${name} did not return structuredContent or text content.`);
  return JSON.parse(text) as T;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

function readCodeDnaServerConfig(mcpConfig: any): any {
  return mcpConfig?.codedna ?? mcpConfig?.mcp_servers?.codedna ?? mcpConfig?.mcpServers?.codedna;
}

async function assertFileExists(path: string): Promise<void> {
  const value = await stat(path);
  ensure(value.isFile(), `Expected file artifact but found non-file path: ${path}`);
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureObjectPath(source: Record<string, any>, path: string[]): void {
  let current: unknown = source;
  for (const key of path) {
    ensure(current && typeof current === "object" && key in current, `Missing JSON field: ${path.join(".")}`);
    current = (current as Record<string, unknown>)[key];
  }
}

function ensureExecutionLevel(score: number, executionLevel: string, readyForCodex: boolean): void {
  if (score >= 90) {
    ensure(readyForCodex === true && executionLevel === "full", "Score >= 90 must map to full execution.");
  } else if (score >= 70) {
    ensure(readyForCodex === true && executionLevel === "cautious", "Score 70-89 must map to cautious execution.");
  } else {
    ensure(readyForCodex === false && executionLevel === "blocked", "Score below 70 must map to blocked execution.");
  }
}

function stringEnv(source: NodeJS.ProcessEnv | Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCodeDnaMcpE2E();
  console.log(JSON.stringify(result, null, 2));
}
