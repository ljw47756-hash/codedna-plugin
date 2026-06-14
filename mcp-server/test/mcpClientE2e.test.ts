import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { runCodeDnaMcpE2E } from "../scripts/e2e.ts";

test("CodeDNA MCP server supports a real stdio client workflow", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-mcp-e2e-"));
  try {
    const result = await runCodeDnaMcpE2E({
      dataRoot: join(workspace, "data"),
      exampleDir: join(workspace, "examples"),
      writeExampleOutputs: true
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.tools_called, [
      "codedna_load_memory",
      "codedna_scan_project",
      "codedna_parse_requirement",
      "codedna_reverse_analyze",
      "codedna_pair_strands",
      "codedna_generate_task_pack",
      "codedna_review_output",
      "codedna_update_memory"
    ]);
    assert.ok(result.tools_available.includes("codedna_run_full_workflow"));
    assert.ok(result.tools_available.includes("codedna_build_project_genome"));
    assert.ok(result.tools_available.includes("codedna_review_diff"));
    assert.ok(result.tools_available.includes("codedna_generate_guardrails"));
    assert.ok(result.tools_available.includes("codedna_validate_changes"));
    assert.ok(result.tools_available.includes("codedna_generate_repair_task"));
    assert.ok(result.tools_available.includes("codedna_propose_memory_update"));
    assert.ok(result.tools_available.includes("codedna_confirm_memory_update"));
    assert.ok(result.tools_available.includes("codedna_generate_test_plan"));
    assert.ok(result.tools_available.includes("codedna_score_outcome"));
    assert.ok(result.pairing_score >= 70);
    assert.match(result.execution_level, /full|cautious/);
    assert.match(result.artifacts.task_pack, /data[\\/]+tasks/);
    assert.match(result.artifacts.review, /data[\\/]+reviews/);
    assert.match(result.generated_examples.task_pack, /generated-task-pack\.md$/);
    assert.match(result.generated_examples.review_report, /generated-review-report\.md$/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
