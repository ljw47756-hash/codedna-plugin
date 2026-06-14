export interface DependencyFile {
  path: string;
  kind: string;
  packages: string[];
}

export interface ProjectProfile {
  project_path: string;
  project_name: string;
  language: string[];
  framework: string[];
  package_manager: string;
  dependency_files: DependencyFile[];
  main_directories: string[];
  entry_points: string[];
  component_dirs: string[];
  api_dirs: string[];
  config_files: string[];
  test_dirs: string[];
  do_not_touch: string[];
  tree_summary: string[];
  notes: string[];
  scanned_at: string;
}
