export type Priority = "low" | "medium" | "high";

export interface RequirementStrand {
  original_request: string;
  core_goal: string;
  features: string[];
  constraints: string[];
  preferences: string[];
  acceptance_criteria: string[];
  unknowns: string[];
  priority: Priority;
  user_memory_related_rules: string[];
  created_at: string;
}
