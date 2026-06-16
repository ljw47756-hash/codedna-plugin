import { sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
import { MemoryStore } from "../storage/memoryStore.js";
import type { BenchmarkMemoryPaths, BenchmarkRepairPlan, BenchmarkRunResult, BenchmarkScoreSummary } from "./benchmarkTypes.js";

export interface WriteBenchmarkMemoryInput {
  data_root: string;
  run_result: BenchmarkRunResult;
  score_summary: BenchmarkScoreSummary;
  repair_plan?: BenchmarkRepairPlan;
}

export async function writeBenchmarkMemory(input: WriteBenchmarkMemoryInput): Promise<BenchmarkMemoryPaths> {
  const memory = new MemoryStore(input.data_root);
  await memory.ensureLayout();
  await ensureEvolutionLayout(memory);
  const benchmarkRunPath = await memory.store.writeJson(
    `memory/evolution/benchmark-runs/${timestampedName(input.run_result.round_id, ".json")}`,
    {
      round_id: input.run_result.round_id,
      timestamp: input.run_result.generated_at,
      generated_cases: input.run_result.case_results.map((result) => result.case),
      actual_results: input.run_result.case_results.map((result) => ({
        case_id: result.case.case_id,
        actual: result.actual,
        warnings: result.warnings
      })),
      failed_cases: input.score_summary.failed_cases,
      accuracy: input.score_summary.accuracy,
      failure_patterns: input.score_summary.failure_patterns,
      repair_actions: input.repair_plan?.repair_actions ?? [],
      next_round_recommendation: input.repair_plan?.next_round_recommendation ?? "No repair plan generated."
    }
  );

  const failurePatternPaths: string[] = [];
  for (const failed of input.score_summary.failed_cases) {
    failurePatternPaths.push(
      await memory.store.writeJson(`memory/evolution/failure-patterns/${timestampedName(`${failed.case_id}-${failed.level}`, ".json")}`, {
        ...failed,
        timestamp: input.run_result.generated_at
      })
    );
  }

  const failedIds = new Set(input.score_summary.failed_cases.map((failed) => failed.case_id));
  const successfulPatternPaths: string[] = [];
  for (const result of input.run_result.case_results.filter((item) => !failedIds.has(item.case.case_id)).slice(0, 50)) {
    successfulPatternPaths.push(
      await memory.store.writeJson(`memory/evolution/successful-patterns/${timestampedName(`${result.case.case_id}-${result.case.level}`, ".json")}`, {
        case_id: result.case.case_id,
        request: result.case.request,
        why_it_passed: `Matched ${result.case.level} expectations with execution_level=${result.actual.execution_level} and pairing_score=${result.actual.pairing_score}.`,
        reusable_pattern: reusablePatternFor(result.case.level),
        timestamp: input.run_result.generated_at
      })
    );
  }

  let repairPath: string | undefined;
  if (input.repair_plan) {
    repairPath = await memory.store.writeJson(
      `memory/evolution/repairs/${timestampedName(sanitizeFilename(input.repair_plan.round_id, "round"), ".json")}`,
      { ...input.repair_plan, timestamp: input.run_result.generated_at }
    );
  }

  return { benchmark_run_path: benchmarkRunPath, failure_pattern_paths: failurePatternPaths, successful_pattern_paths: successfulPatternPaths, repair_path: repairPath };
}

async function ensureEvolutionLayout(memory: MemoryStore): Promise<void> {
  await memory.store.ensureDir("memory/evolution/benchmark-runs");
  await memory.store.ensureDir("memory/evolution/failure-patterns");
  await memory.store.ensureDir("memory/evolution/successful-patterns");
  await memory.store.ensureDir("memory/evolution/repairs");
}

function reusablePatternFor(level: string): string {
  if (level === "blocked") {
    return "Vague or unsafe requests must stop at clarification before Codex edits files.";
  }
  if (level === "cautious") {
    return "Scoped but risky tasks should produce a task pack with visible warnings, assumptions, and guardrails.";
  }
  if (level === "full") {
    return "Clear, scoped tasks with acceptance criteria may produce a full Codex task pack.";
  }
  return "Edge cases require security warnings and must not be released as full execution.";
}
