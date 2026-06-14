export type MemoryScope = "session" | "project" | "user";

export interface LayeredMemoryRecord {
  memory_id: string;
  memory_scope: MemoryScope;
  content: string;
  source_text: string;
  reason: string;
  confidence: number;
  requires_confirmation: boolean;
  confirmed: boolean;
  project_id?: string;
  task_id?: string;
  created_at: string;
  updated_at: string;
  schema_version: number;
}

export interface LayeredMemoryFile {
  schema_version: number;
  memory_scope: MemoryScope;
  project_id?: string;
  task_id?: string;
  memories: LayeredMemoryRecord[];
  updated_at: string;
}

export interface MemoryProposal {
  proposal_id: string;
  memory_scope: MemoryScope;
  proposed_memory: LayeredMemoryRecord;
  source_text: string;
  reason: string;
  confidence: number;
  requires_confirmation: boolean;
  suggested_action: string;
  preview: string;
  created_at: string;
  schema_version: number;
}

export interface LayeredMemorySnapshot {
  user: LayeredMemoryFile;
  projects: Record<string, LayeredMemoryFile>;
  sessions: Record<string, LayeredMemoryFile>;
  proposals: MemoryProposal[];
}
