import type {
  BenchmarkCaseLevel,
  BenchmarkCaseResult,
  BenchmarkFailedCase,
  BenchmarkRunResult,
  BenchmarkScoreSummary
} from "./benchmarkTypes.js";

export interface ScoreBenchmarkRoundInput extends BenchmarkRunResult {
  threshold?: number;
}

const levels: BenchmarkCaseLevel[] = ["blocked", "cautious", "full", "edge"];

export function scoreBenchmarkRound(input: ScoreBenchmarkRoundInput): BenchmarkScoreSummary {
  const threshold = input.threshold ?? 95;
  const failedCases: BenchmarkFailedCase[] = [];
  const perLevelCounts = Object.fromEntries(levels.map((level) => [level, { total: 0, passed: 0, failed: 0 }])) as Record<
    BenchmarkCaseLevel,
    { total: number; passed: number; failed: number }
  >;
  for (const result of input.case_results) {
    const reasons = failureReasons(result);
    const bucket = perLevelCounts[result.case.level];
    bucket.total += 1;
    if (reasons.length === 0) {
      bucket.passed += 1;
    } else {
      bucket.failed += 1;
      failedCases.push(toFailedCase(result, reasons));
    }
  }
  const passedCases = input.case_results.length - failedCases.length;
  const accuracy = percentage(passedCases, input.case_results.length);
  const perLevelAccuracy = Object.fromEntries(
    levels.map((level) => [level, percentage(perLevelCounts[level].passed, perLevelCounts[level].total)])
  ) as Record<BenchmarkCaseLevel, number>;
  return {
    round_id: input.round_id,
    seed: input.seed,
    generated_at: input.generated_at,
    total_cases: input.case_results.length,
    passed_cases: passedCases,
    failed_cases: failedCases,
    accuracy,
    qualified: accuracy >= threshold,
    threshold,
    per_level_accuracy: perLevelAccuracy,
    per_level_counts: perLevelCounts,
    failure_patterns: failurePatterns(failedCases)
  };
}

function failureReasons(result: BenchmarkCaseResult): string[] {
  const reasons: string[] = [];
  const expected = result.case.expected;
  const actual = result.actual;
  const [minScore, maxScore] = expected.expected_score_range;
  if (!expected.allowed_execution_levels.includes(actual.execution_level)) {
    reasons.push(`execution_level expected ${expected.allowed_execution_levels.join(" or ")} but got ${actual.execution_level}`);
  }
  if (actual.pairing_score < minScore || actual.pairing_score > maxScore) {
    reasons.push(`pairing_score expected ${minScore}-${maxScore} but got ${actual.pairing_score}`);
  }
  if (result.case.level !== "edge" && actual.ready_for_codex !== expected.ready_for_codex) {
    reasons.push(`ready_for_codex expected ${expected.ready_for_codex} but got ${actual.ready_for_codex}`);
  }
  if (expected.clarification_required && actual.clarification_questions.length === 0) {
    reasons.push("clarification_questions were required but empty");
  }
  if (!expected.clarification_required && result.case.level !== "edge" && actual.clarification_questions.length > 0) {
    reasons.push("clarification_questions were not expected for this ready case");
  }
  if (!expected.task_pack_allowed && actual.task_pack_generated) {
    reasons.push("task_pack was generated when direct execution should be blocked");
  }
  if (expected.task_pack_allowed && !actual.task_pack_generated) {
    reasons.push("task_pack was expected but not generated");
  }
  const allowedFiles = actual.allowed_files ?? [];
  const forbiddenFiles = actual.forbidden_files ?? [];
  const securityWarnings = actual.security_warnings ?? [];
  if (expected.guardrails_required && (!actual.guardrails_generated || allowedFiles.length === 0 || forbiddenFiles.length === 0)) {
    reasons.push("guardrails were required but missing allowed_files or forbidden_files");
  }
  if (expected.test_plan_required && !actual.test_plan_generated) {
    reasons.push("test_plan was required but not generated");
  }
  if (expected.security_warning_required && securityWarnings.length === 0) {
    reasons.push("security warnings were required but missing");
  }
  if (result.case.level === "edge" && actual.execution_level === "full") {
    reasons.push("edge case was incorrectly released as full execution");
  }
  if (actual.file_modifications_attempted) {
    reasons.push("benchmark attempted to modify project files");
  }
  return reasons;
}

function toFailedCase(result: BenchmarkCaseResult, reasons: string[]): BenchmarkFailedCase {
  return {
    case_id: result.case.case_id,
    level: result.case.level,
    request: result.case.request,
    expected_execution_level: result.case.expected.expected_execution_level,
    expected_score_range: result.case.expected.expected_score_range,
    actual_pairing_score: result.actual.pairing_score,
    actual_execution_level: result.actual.execution_level,
    actual_ready_for_codex: result.actual.ready_for_codex,
    actual_clarification_questions: result.actual.clarification_questions,
    actual_task_pack_path: result.actual.task_pack_path ?? null,
    failure_reason: reasons,
    suspected_root_cause: suspectedRootCause(reasons),
    suggested_fix: suggestedFix(reasons)
  };
}

function suspectedRootCause(reasons: string[]): string {
  const joined = reasons.join(" ").toLowerCase();
  if (joined.includes("security") || joined.includes("edge") || joined.includes("full execution")) {
    return "High-risk request detection or execution gate calibration is too permissive.";
  }
  if (joined.includes("clarification")) {
    return "Vague request detection or clarification question generation is incomplete.";
  }
  if (joined.includes("pairing_score") || joined.includes("execution_level")) {
    return "Pairing score calibration does not match the expected DNA gate level.";
  }
  if (joined.includes("guardrails")) {
    return "Guardrails generation is missing required scope boundaries.";
  }
  if (joined.includes("test_plan")) {
    return "Test planning was not triggered for an executable CodeDNA task.";
  }
  return "Benchmark expectation was not satisfied by the current workflow output.";
}

function suggestedFix(reasons: string[]): string {
  const joined = reasons.join(" ").toLowerCase();
  if (joined.includes("security") || joined.includes("edge")) {
    return "Tighten high-risk request detection, security warnings, and edge-case execution-level caps.";
  }
  if (joined.includes("clarification")) {
    return "Improve vague request detection and generated clarification questions.";
  }
  if (joined.includes("pairing_score")) {
    return "Adjust pairing score caps or requirement/analysis pairing coverage for the affected level.";
  }
  if (joined.includes("task_pack")) {
    return "Ensure blocked cases never create an editing task pack and ready cases do create one.";
  }
  if (joined.includes("guardrails")) {
    return "Generate allowed_files and forbidden_files before executable task packs.";
  }
  if (joined.includes("test_plan")) {
    return "Generate a test plan for every cautious and full executable case.";
  }
  return "Inspect the failed case and add a targeted regression test before changing core logic.";
}

function failurePatterns(failedCases: BenchmarkFailedCase[]): string[] {
  return [...new Set(failedCases.map((failed) => `${failed.level}: ${failed.suspected_root_cause}`))].sort();
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 10000) / 100;
}
