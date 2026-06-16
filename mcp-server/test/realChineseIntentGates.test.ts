import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { runFullWorkflow } from "../src/tools/runFullWorkflow.js";

async function withFixtureProject<T>(fn: (project: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-real-zh-"));
  const project = join(workspace, "plugin");
  const memory = new MemoryStore(join(workspace, "data"));
  try {
    await mkdir(join(project, "docs"), { recursive: true });
    await mkdir(join(project, "examples"), { recursive: true });
    await mkdir(join(project, "mcp-server", "test"), { recursive: true });
    await writeFile(join(project, "package.json"), JSON.stringify({ scripts: { test: "node --test", build: "tsc" } }, null, 2), "utf8");
    await writeFile(join(project, "docs", "WORKFLOW_EXAMPLES.md"), "# Workflow examples\n", "utf8");
    await writeFile(join(project, "examples", "sample-review-report.md"), "# Review report\n", "utf8");
    await writeFile(join(project, "mcp-server", "test", "chineseRequirement.test.ts"), "import test from 'node:test';\n", "utf8");
    await memory.ensureLayout();
    return await fn(project, memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

test("real Chinese hard intents route to blocked, cautious, and full gates", async () => {
  await withFixtureProject(async (project, memory) => {
    const blocked = await runFullWorkflow(
      {
        user_request: "不要继续新增功能，只做最终检查；不过我没说检查哪些文件和验收命令。",
        project_path: project,
        use_project_genome: false,
        use_memory: false
      },
      memory
    );
    assert.equal(blocked.pairing_result.execution_level, "blocked");
    assert.ok(blocked.clarification_questions.length > 0);
    assert.equal(blocked.task_pack_path, undefined);

    const cautious = await runFullWorkflow(
      {
        user_request: "先给我优化方案，不要改代码。重点识别“不是A是B”“等我说继续”“不要新增功能”。验收：输出风险、缺失信息和下一步计划。",
        project_path: project,
        use_project_genome: false,
        use_memory: false
      },
      memory
    );
    assert.equal(cautious.pairing_result.execution_level, "cautious");
    assert.ok(cautious.pairing_result.pairing_score >= 70);
    assert.ok(cautious.pairing_result.pairing_score <= 89);
    assert.ok(cautious.task_pack_path);

    const full = await runFullWorkflow(
      {
        user_request: "在 examples/sample-review-report.md 增加一个失败后修复任务提示词示例，只修改该示例文件。验收：包含 next Codex repair prompt。",
        project_path: project,
        use_project_genome: false,
        use_memory: false
      },
      memory
    );
    assert.equal(full.pairing_result.execution_level, "full");
    assert.ok(full.pairing_result.pairing_score >= 90);
    assert.ok(full.task_pack_path);
  });
});
