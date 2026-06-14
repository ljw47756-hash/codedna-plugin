import type { DependencyFile } from "./projectProfile.js";

export interface ProjectGenome {
  schema_version: number;
  project_id: string;
  project_name: string;
  project_root: string;
  project_type: string[];
  language: string[];
  framework: string[];
  package_manager: string;
  architecture_style: string[];
  entry_points: string[];
  routing_files: string[];
  api_files: string[];
  component_dirs: string[];
  state_management_files: string[];
  config_files: string[];
  test_dirs: string[];
  test_strategy: string[];
  safe_edit_zones: string[];
  forbidden_zones: string[];
  detected_patterns: string[];
  dependency_files: DependencyFile[];
  risk_areas: string[];
  recommended_codex_rules: string[];
  tree_summary: string[];
  last_scanned_at: string;
  [customField: string]: unknown;
}
