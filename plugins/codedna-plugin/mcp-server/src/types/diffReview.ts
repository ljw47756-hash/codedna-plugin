import type { FinalVerdict, RiskLevel } from "./guardrails.js";

export interface DiffReview {
  review_id: string;
  modified_files: string[];
  added_files: string[];
  deleted_files: string[];
  forbidden_files_touched: string[];
  unrelated_changes: string[];
  dangerous_commands: string[];
  hardcoded_secrets: string[];
  api_keys: string[];
  large_unrequested_refactor: boolean;
  missing_tests: string[];
  requirement_mismatch: string[];
  architecture_risks: string[];
  security_risks: string[];
  performance_risks: string[];
  risk_level: RiskLevel;
  required_fixes: string[];
  final_verdict: FinalVerdict;
  next_codex_repair_prompt: string;
}
