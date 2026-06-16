import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { generateTaskPack } from "../src/tools/generateTaskPack.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";
import type { ProjectProfile } from "../src/types/projectProfile.js";

async function withMemory<T>(fn: (memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-cautious-handoff-"));
  try {
    const memory = new MemoryStore(join(workspace, "data"));
    await memory.ensureLayout();
    return await fn(memory);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

test("implicit approval gates stay cautious and task packs tell Codex how to assist before editing", async () => {
  await withMemory(async (memory) => {
    const parsed = await parseRequirement(
      {
        request:
          "First inspect why npm run build fails and prepare a repair plan. Hold all file changes until I confirm. Acceptance: list evidence, risks, commands, and the next Codex prompt."
      },
      memory
    );
    const analysis = await reverseAnalyze({ requirement_strand: parsed.requirement_strand }, memory);
    const paired = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        save: false
      },
      memory
    );

    assert.equal(paired.pairing_result.ready_for_codex, true);
    assert.equal(paired.pairing_result.execution_level, "cautious");
    assert.ok(paired.pairing_result.pairing_score >= 70);
    assert.ok(paired.pairing_result.pairing_score < 90);
    assert.ok(paired.pairing_result.warnings.some((warning) => /approval|planning|cautious/i.test(warning)));

    const taskPack = await generateTaskPack(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        pairing_result: paired.pairing_result,
        save: false
      },
      memory
    );

    assert.match(taskPack.codex_task_pack.markdown, /Codex Execution Mode/);
    assert.match(taskPack.codex_task_pack.markdown, /Do not edit files until the user approves execution/i);
    assert.match(taskPack.codex_task_pack.markdown, /Next Codex Prompt/i);
  });
});

test("package-file exclusion keeps otherwise clear implementation work cautious", async () => {
  await withMemory(async (memory) => {
    const projectProfile = fixtureProfile();
    const parsed = await parseRequirement(
      {
        request:
          "Improve error messages for a missing project_path in the MCP server, but avoid changing package files. Acceptance: tests cover the error message.",
        project_profile: projectProfile
      },
      memory
    );
    const analysis = await reverseAnalyze({ requirement_strand: parsed.requirement_strand, project_profile: projectProfile }, memory);
    const paired = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        save: false
      },
      memory
    );

    assert.equal(paired.pairing_result.ready_for_codex, true);
    assert.equal(paired.pairing_result.execution_level, "cautious");
    assert.ok(paired.pairing_result.pairing_score >= 70);
    assert.ok(paired.pairing_result.pairing_score < 90);
  });
});

function fixtureProfile(): ProjectProfile {
  return {
    project_path: "<PROJECT_ROOT>",
    project_name: "codedna-test",
    language: ["TypeScript"],
    framework: ["MCP"],
    package_manager: "npm",
    dependency_files: [{ path: "package.json", kind: "npm", packages: [] }],
    main_directories: ["src", "mcp-server"],
    entry_points: ["mcp-server/src/server.ts"],
    component_dirs: [],
    api_dirs: [],
    config_files: ["package.json", "tsconfig.json"],
    test_dirs: ["mcp-server/test"],
    do_not_touch: ["package.json", "package-lock.json", "node_modules/"],
    tree_summary: ["mcp-server/src", "mcp-server/test"],
    notes: [],
    scanned_at: "2026-06-16T00:00:00.000Z"
  };
}
