export type TaskType = "ui" | "api" | "bug_fix" | "refactor" | "general";

export interface GeneratedTestPlan {
  test_plan_id: string;
  manual_test_steps: string[];
  automated_test_suggestions: string[];
  edge_cases: string[];
  failure_cases: string[];
  regression_scope: string[];
  required_commands: string[];
  acceptance_checklist: string[];
  missing_test_warning: string;
  test_plan_markdown: string;
  test_plan_path?: string;
}
