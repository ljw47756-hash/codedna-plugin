import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { generateTaskPack } from "../src/tools/generateTaskPack.js";
import { pairStrands } from "../src/tools/pairStrands.js";
import { parseRequirement } from "../src/tools/parseRequirement.js";
import { reviewCodexOutput } from "../src/tools/reviewCodexOutput.js";
import { reverseAnalyze } from "../src/tools/reverseAnalyze.js";

async function withMemory<T>(fn: (workspace: string, memory: MemoryStore) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-dna-core-"));
  const memory = new MemoryStore(join(workspace, "data"));
  return fn(workspace, memory);
}

test("CodeDNA core flow keeps the double-strand model connected to effects and case recall", async () => {
  await withMemory(async (_workspace, memory) => {
    const parsed = await parseRequirement(
      {
        request:
          "请使用 CodeDNA 优化插件安装文档，不要公开详细内部能力，避免别人抄袭。先做最终检查和文档收口，等我说继续再做发布。",
        memory_rules: ["Prefer proposal-first memory evolution before writing permanent memory."]
      },
      memory
    );
    const analyzed = await reverseAnalyze({ requirement_strand: parsed.requirement_strand }, memory);
    const paired = await pairStrands(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analyzed.analysis_strand,
        save: false
      },
      memory
    );

    assert.equal(paired.pairing_result.dna_alignment?.requirement_strand, "User Requirement Strand");
    assert.equal(paired.pairing_result.dna_alignment?.analysis_strand, "Reverse Analysis Strand");
    assert.equal(paired.pairing_result.dna_alignment?.pairing_review, "Bidirectional Pairing Review");
    assert.ok((paired.pairing_result.activated_effects ?? []).length > 0);
    assert.ok((paired.pairing_result.case_recall?.success_patterns ?? []).length > 0);
    assert.ok((paired.pairing_result.case_recall?.failure_patterns ?? []).length > 0);
    assert.ok(maxRun((paired.pairing_result.activated_effects ?? []).map((item) => item.effect_family)) <= 2);
    assert.ok(uniqueCount((paired.pairing_result.activated_effects ?? []).map((item) => item.effect_family)) >= 3);
    assert.ok(uniqueCount((paired.pairing_result.case_recall?.success_patterns ?? []).map((item) => item.effect_family ?? item.category)) >= 3);
    assert.ok(uniqueCount((paired.pairing_result.case_recall?.failure_patterns ?? []).map((item) => item.effect_family ?? item.category)) >= 3);
    assert.ok((paired.pairing_result.score_explanation ?? []).some((item) => /effect|case/i.test(item)));
    assert.ok(paired.pairing_result.pairing_score >= 70);

    const taskPack = await generateTaskPack(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analyzed.analysis_strand,
        pairing_result: paired.pairing_result,
        save: false
      },
      memory
    );

    const taskMarkdown = taskPack.codex_task_pack.markdown;
    assert.match(taskMarkdown, /用户需求链/u);
    assert.match(taskMarkdown, /配对审查/u);
    assert.match(taskMarkdown, /反向解析链/u);
    assert.match(taskMarkdown, /Codex 任务包/u);
    assert.match(taskMarkdown, /Activated CodeDNA Effects/u);
    assert.match(taskMarkdown, /Relevant Success Patterns/u);
    assert.match(taskMarkdown, /Relevant Failure Patterns/u);

    const reviewed = await reviewCodexOutput(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analyzed.analysis_strand,
        codex_output: [
          "Summary:",
          "- Updated README.md with installation docs and internal capability details.",
          "Files Changed:",
          "- README.md: documented every internal CodeDNA capability.",
          "Verification:",
          "- Not run."
        ].join("\n"),
        save: false
      },
      memory
    );

    const reviewMarkdown = reviewed.review_report.markdown;
    assert.match(reviewMarkdown, /反向审查/u);
    assert.match(reviewMarkdown, /记忆进化/u);
    assert.match(reviewMarkdown, /Relevant Failure Patterns/u);
    assert.match(reviewMarkdown, /Memory Evolution Proposal/u);
  });
});

function maxRun(items: string[]): number {
  let current = 0;
  let max = 0;
  let previous = "";
  for (const item of items) {
    current = item === previous ? current + 1 : 1;
    previous = item;
    max = Math.max(max, current);
  }
  return max;
}

function uniqueCount(items: string[]): number {
  return new Set(items.filter(Boolean)).size;
}
