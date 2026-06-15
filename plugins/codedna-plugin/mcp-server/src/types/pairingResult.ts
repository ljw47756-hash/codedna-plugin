export interface StrandPair {
  pair_type: string;
  requirement_item: string;
  analysis_item: string;
  status: "matched" | "general" | "weak" | "unmatched" | "not_applicable";
  confidence: number;
  notes?: string;
}

export interface DnaAlignment {
  requirement_strand: "User Requirement Strand";
  pairing_review: "Bidirectional Pairing Review";
  analysis_strand: "Reverse Analysis Strand";
  execution_layer: "Codex Task Pack";
  feedback_layer: "Reverse Review";
  evolution_layer: "Memory Evolution";
  flow: string[];
  gate_status: "ready" | "cautious" | "blocked";
}

export interface ActivatedEffect {
  id: string;
  effect_family: string;
  fit: string;
  activation_surface: string;
  codedna_target: string;
  pair_type: string;
  weight: number;
  matched_terms: string[];
  summary: string;
  codedna_pattern: string;
  guardrail: string;
}

export interface RecalledCase {
  id: string;
  category: string;
  outcome: string;
  effect_family?: string;
  score: number;
  summary: string;
  codedna_pattern: string;
  guardrail: string;
  tags: string[];
}

export interface CaseRecall {
  query_terms: string[];
  success_patterns: RecalledCase[];
  failure_patterns: RecalledCase[];
  public_patterns: RecalledCase[];
}

export interface RuleWeightAdjustment {
  pair_type: string;
  base_weight: number;
  adjusted_weight: number;
  activated_effect_ids: string[];
}

export interface CodexAssistanceStep {
  stage: string;
  codex_role: string;
  prompt: string;
  expected_output: string;
  use_when: string;
}

export interface PairingResult {
  pairing_score: number;
  matched_pairs: StrandPair[];
  unmatched_pairs: StrandPair[];
  warnings: string[];
  missing_information: string[];
  ready_for_codex: boolean;
  execution_level: "full" | "cautious" | "blocked";
  dna_alignment?: DnaAlignment;
  activated_effects?: ActivatedEffect[];
  case_recall?: CaseRecall;
  rule_weight_adjustments?: RuleWeightAdjustment[];
  score_explanation?: string[];
  codex_assistance?: CodexAssistanceStep[];
  created_at: string;
}
