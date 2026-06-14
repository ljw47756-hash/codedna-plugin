import type { FinalVerdict } from "./guardrails.js";

export interface OutcomeScore {
  outcome_score_id: string;
  requirement_match_score: number;
  constraint_compliance_score: number;
  code_quality_score: number;
  test_coverage_score: number;
  architecture_consistency_score: number;
  risk_score: number;
  overall_score: number;
  final_verdict: FinalVerdict;
  next_action: string;
  score_reasons: string[];
}
