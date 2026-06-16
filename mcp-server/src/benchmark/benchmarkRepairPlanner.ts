import type { BenchmarkRepairPlan, BenchmarkScoreSummary } from "./benchmarkTypes.js";

export function planBenchmarkRepairs(score: BenchmarkScoreSummary): BenchmarkRepairPlan {
  const rootCauses = unique(score.failed_cases.map((failed) => failed.suspected_root_cause));
  const repairActions = unique(score.failed_cases.map((failed) => actionFor(failed.suggested_fix)));
  const regressionTests = unique(score.failed_cases.map((failed) => regressionFor(failed.level, failed.failure_reason)));
  return {
    round_id: score.round_id,
    root_causes: rootCauses,
    repair_actions: repairActions,
    regression_tests: regressionTests,
    next_round_recommendation: score.qualified
      ? "No repair loop required. Preserve the successful patterns and publish the sanitized report."
      : "Apply the listed targeted repairs, add regression coverage, then run the next 100-case benchmark round."
  };
}

function actionFor(suggestedFix: string): string {
  if (/security|edge|high-risk/i.test(suggestedFix)) {
    return "Calibrate high-risk request detection and prevent edge cases from reaching full execution.";
  }
  if (/vague|clarification/i.test(suggestedFix)) {
    return "Improve vague request detection and clarification question generation.";
  }
  if (/pairing score|score caps|calibration/i.test(suggestedFix)) {
    return "Adjust pairing score calculation and execution-level caps without hardcoding individual cases.";
  }
  if (/task pack/i.test(suggestedFix)) {
    return "Guard task pack generation so blocked cases produce only clarification guidance.";
  }
  if (/guardrails/i.test(suggestedFix)) {
    return "Ensure executable cases always create allowed and forbidden file guardrails.";
  }
  if (/test plan/i.test(suggestedFix)) {
    return "Ensure executable cases always produce a focused verification plan.";
  }
  return "Add a focused regression test for the failed behavior before editing core logic.";
}

function regressionFor(level: string, reasons: string[]): string {
  const joined = reasons.join(" ");
  if (/security|edge|full execution/i.test(joined)) {
    return "Add a regression case ensuring security-sensitive or destructive requests are blocked or cautious, never full.";
  }
  if (/clarification/i.test(joined)) {
    return "Add a regression case ensuring vague requests produce clarification questions and no editing task pack.";
  }
  if (/pairing_score|execution_level/i.test(joined)) {
    return `Add a ${level} benchmark regression case for pairing_score and execution_level calibration.`;
  }
  if (/guardrails/i.test(joined)) {
    return "Add a regression case ensuring ready tasks include allowed_files and forbidden_files.";
  }
  if (/test_plan/i.test(joined)) {
    return "Add a regression case ensuring ready tasks include a test plan.";
  }
  return `Add a focused ${level} regression benchmark case.`;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))].sort();
}
