import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { CodeDnaGuardrails } from "../types/guardrails.js";
import type { GeneratedTestPlan } from "../types/generatedTestPlan.js";
import type { PairingResult } from "../types/pairingResult.js";
import type { RequirementStrand } from "../types/requirementStrand.js";

export type BenchmarkCaseLevel = "blocked" | "cautious" | "full" | "edge";
export type BenchmarkExecutionLevel = "blocked" | "cautious" | "full";

export interface BenchmarkCaseExpectation {
  expected_execution_level: BenchmarkExecutionLevel;
  allowed_execution_levels: BenchmarkExecutionLevel[];
  expected_score_range: [number, number];
  ready_for_codex: boolean;
  clarification_required: boolean;
  task_pack_allowed: boolean;
  guardrails_required: boolean;
  test_plan_required: boolean;
  security_warning_required: boolean;
}

export interface BenchmarkCase {
  case_id: string;
  level: BenchmarkCaseLevel;
  request: string;
  tags: string[];
  expected: BenchmarkCaseExpectation;
}

export interface BenchmarkCaseSuite {
  suite_id: string;
  seed: number;
  generated_at: string;
  cases: BenchmarkCase[];
  distribution: Record<BenchmarkCaseLevel, number>;
}

export interface BenchmarkActualResult {
  pairing_score: number;
  execution_level: BenchmarkExecutionLevel;
  ready_for_codex: boolean;
  clarification_questions: string[];
  task_pack_path?: string;
  task_pack_generated: boolean;
  guardrails_generated: boolean;
  allowed_files: string[];
  forbidden_files: string[];
  test_plan_generated: boolean;
  security_warnings: string[];
  file_modifications_attempted: boolean;
}

export interface BenchmarkCaseResult {
  case: BenchmarkCase;
  requirement_strand: RequirementStrand;
  analysis_strand: AnalysisStrand;
  pairing_result: PairingResult;
  actual: BenchmarkActualResult;
  guardrails?: CodeDnaGuardrails;
  test_plan?: GeneratedTestPlan;
  warnings: string[];
}

export interface BenchmarkRunResult {
  round_id: string;
  seed: number;
  generated_at: string;
  case_results: BenchmarkCaseResult[];
}

export interface BenchmarkFailedCase {
  case_id: string;
  level: BenchmarkCaseLevel;
  request: string;
  expected_execution_level: BenchmarkExecutionLevel;
  expected_score_range: [number, number];
  actual_pairing_score: number;
  actual_execution_level: BenchmarkExecutionLevel;
  actual_ready_for_codex: boolean;
  actual_clarification_questions: string[];
  actual_task_pack_path: string | null;
  failure_reason: string[];
  suspected_root_cause: string;
  suggested_fix: string;
}

export interface BenchmarkScoreSummary {
  round_id: string;
  seed: number;
  generated_at: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: BenchmarkFailedCase[];
  accuracy: number;
  qualified: boolean;
  threshold: number;
  per_level_accuracy: Record<BenchmarkCaseLevel, number>;
  per_level_counts: Record<BenchmarkCaseLevel, { total: number; passed: number; failed: number }>;
  failure_patterns: string[];
}

export interface BenchmarkRepairPlan {
  round_id: string;
  root_causes: string[];
  repair_actions: string[];
  regression_tests: string[];
  next_round_recommendation: string;
}

export interface BenchmarkMemoryPaths {
  benchmark_run_path: string;
  failure_pattern_paths: string[];
  successful_pattern_paths: string[];
  repair_path?: string;
}

export interface BenchmarkReportPaths {
  benchmark_report_path: string;
  evolution_log_path: string;
}
