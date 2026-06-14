export interface AnalysisStrand {
  technical_goal: string;
  suggested_architecture: string[];
  required_modules: string[];
  affected_files: string[];
  implementation_steps: string[];
  risks: string[];
  dependencies: string[];
  test_plan: string[];
  rollback_plan: string[];
  assumptions: string[];
  created_at: string;
}
