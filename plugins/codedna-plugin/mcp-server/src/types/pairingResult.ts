export interface StrandPair {
  pair_type: string;
  requirement_item: string;
  analysis_item: string;
  status: "matched" | "general" | "weak" | "unmatched" | "not_applicable";
  confidence: number;
  notes?: string;
}

export interface PairingResult {
  pairing_score: number;
  matched_pairs: StrandPair[];
  unmatched_pairs: StrandPair[];
  warnings: string[];
  missing_information: string[];
  ready_for_codex: boolean;
  execution_level: "full" | "cautious" | "blocked";
  created_at: string;
}
