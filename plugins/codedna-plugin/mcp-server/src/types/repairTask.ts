export interface RepairTask {
  repair_task_id: string;
  repair_goal: string;
  issues_to_fix: string[];
  files_allowed: string[];
  files_forbidden: string[];
  step_by_step_fix_plan: string[];
  tests_required: string[];
  safety_rules: string[];
  rollback_notes: string[];
  final_response_format: string;
  repair_task_markdown: string;
  repair_task_path?: string;
}
