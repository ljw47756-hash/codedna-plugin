export type RiskLevel = "low" | "medium" | "high" | "critical";
export type FinalVerdict = "pass" | "pass_with_warnings" | "needs_fix" | "blocked";

export interface CodeDnaGuardrails {
  guardrail_id: string;
  task_id: string;
  allowed_files: string[];
  forbidden_files: string[];
  allowed_operations: string[];
  forbidden_operations: string[];
  required_tests: string[];
  required_final_response_format: string;
  safety_rules: string[];
  risk_level: RiskLevel;
  generated_at: string;
}

export interface GuardrailsValidation {
  guardrail_id: string;
  validation_passed: boolean;
  violations: string[];
  warnings: string[];
  touched_allowed_files: string[];
  touched_forbidden_files: string[];
  missing_required_tests: string[];
  final_verdict: FinalVerdict;
  repair_suggestion: string;
}
