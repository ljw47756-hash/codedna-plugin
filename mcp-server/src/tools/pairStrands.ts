import { nowIso, timestampedName } from "../storage/jsonStore.js";
import type { MemoryStore } from "../storage/memoryStore.js";
import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { PairingResult, StrandPair } from "../types/pairingResult.js";
import type { RequirementStrand } from "../types/requirementStrand.js";
import { similarity, tokens } from "./common.js";

const pairWeights: Record<string, number> = {
  "Goal <-> Task": 20,
  "Constraint <-> Risk": 18,
  "Preference <-> Pattern": 14,
  "Feature <-> Module": 20,
  "Acceptance <-> Test": 18,
  "Memory <-> Reuse": 10
};

export interface PairStrandsInput {
  requirement_strand: RequirementStrand;
  analysis_strand: AnalysisStrand;
  save?: boolean;
}

export interface PairStrandsOutput {
  pairing_result: PairingResult;
  artifact_path?: string;
}

export async function pairStrands(input: PairStrandsInput, memoryStore: MemoryStore): Promise<PairStrandsOutput> {
  const requirement = input.requirement_strand;
  const analysis = input.analysis_strand;
  if (!requirement?.core_goal || !analysis?.technical_goal) {
    throw new Error("codedna_pair_strands requires requirement_strand and analysis_strand.");
  }

  const matched: StrandPair[] = [];
  const unmatched: StrandPair[] = [];
  addGoalPair(requirement, analysis, matched, unmatched);
  addCollectionPairs("Constraint <-> Risk", requirement.constraints, analysis.risks, matched, unmatched);
  addCollectionPairs("Preference <-> Pattern", requirement.preferences, analysis.suggested_architecture, matched, unmatched);
  addCollectionPairs("Feature <-> Module", requirement.features, analysis.required_modules, matched, unmatched);
  addCollectionPairs("Acceptance <-> Test", requirement.acceptance_criteria, analysis.test_plan, matched, unmatched);
  addCollectionPairs("Memory <-> Reuse", requirement.user_memory_related_rules, [...analysis.suggested_architecture, ...analysis.assumptions], matched, unmatched);

  const pairingScore = score(matched, unmatched, requirement.unknowns);
  const result: PairingResult = {
    pairing_score: pairingScore,
    matched_pairs: matched,
    unmatched_pairs: unmatched,
    warnings: warnings(pairingScore, unmatched, requirement.unknowns),
    missing_information: requirement.unknowns,
    ready_for_codex: pairingScore >= 70,
    execution_level: pairingScore >= 90 ? "full" : pairingScore >= 70 ? "cautious" : "blocked",
    created_at: nowIso()
  };

  let artifactPath: string | undefined;
  if (input.save !== false) {
    artifactPath = await memoryStore.saveArtifact(
      `strands/${timestampedName(requirement.core_goal, ".pairing.json")}`,
      result
    );
  }
  return { pairing_result: result, artifact_path: artifactPath };
}

function addGoalPair(
  requirement: RequirementStrand,
  analysis: AnalysisStrand,
  matched: StrandPair[],
  unmatched: StrandPair[]
): void {
  const confidence = itemConfidence("Goal <-> Task", requirement.core_goal, analysis.technical_goal);
  const target = confidence >= 0.35 ? matched : unmatched;
  target.push({
    pair_type: "Goal <-> Task",
    requirement_item: requirement.core_goal,
    analysis_item: analysis.technical_goal,
    status: confidence >= 0.35 ? "matched" : "weak",
    confidence,
    notes: confidence >= 0.35 ? "Core goal is represented by the technical goal." : "Technical goal should be more explicit."
  });
}

function addCollectionPairs(
  pairType: keyof typeof pairWeights,
  requirementItems: string[],
  analysisItems: string[],
  matched: StrandPair[],
  unmatched: StrandPair[]
): void {
  if (requirementItems.length === 0) {
    matched.push({
      pair_type: pairType,
      requirement_item: "No explicit item supplied.",
      analysis_item: "No explicit pairing required.",
      status: "not_applicable",
      confidence: 1
    });
    return;
  }

  for (const requirementItem of requirementItems) {
    const best = bestCandidate(pairType, requirementItem, analysisItems);
    if (best.score >= 0.32 || analysisItems.length > 0) {
      const confidence = best.item ? Math.max(best.score, generalCoverageConfidence(pairType)) : 0.48;
      matched.push({
        pair_type: pairType,
        requirement_item: requirementItem,
        analysis_item: best.item || "Covered by general analysis.",
        status: best.score >= 0.5 ? "matched" : "general",
        confidence
      });
    } else {
      unmatched.push({
        pair_type: pairType,
        requirement_item: requirementItem,
        analysis_item: "",
        status: "unmatched",
        confidence: 0,
        notes: "Requirement item needs stronger technical coverage."
      });
    }
  }
}

function bestCandidate(pairType: keyof typeof pairWeights, source: string, candidates: string[]): { item: string; score: number } {
  let item = "";
  let score = 0;
  for (const candidate of candidates) {
    const current = itemConfidence(pairType, source, candidate);
    if (current > score) {
      item = candidate;
      score = current;
    }
  }
  return { item, score };
}

function itemConfidence(pairType: string, source: string, candidate: string): number {
  const normalizedSource = source.toLocaleLowerCase();
  const normalizedCandidate = candidate.toLocaleLowerCase();
  const lexical = similarity(source, candidate);
  let semantic = 0;

  if (normalizedSource && normalizedCandidate.includes(normalizedSource)) {
    semantic = Math.max(semantic, 0.96);
  }
  if (normalizedCandidate && normalizedSource.includes(normalizedCandidate)) {
    semantic = Math.max(semantic, 0.82);
  }

  const sourceTokens = tokens(source);
  const candidateTokens = tokens(candidate);
  for (const group of semanticGroups(pairType)) {
    const sourceHit = group.requirement.some((token) => sourceTokens.has(token) || normalizedSource.includes(token));
    const candidateHit = group.analysis.some((token) => candidateTokens.has(token) || normalizedCandidate.includes(token));
    if (sourceHit && candidateHit) {
      semantic = Math.max(semantic, group.confidence);
    }
  }

  return Math.min(1, Math.max(lexical, semantic));
}

function semanticGroups(pairType: string): Array<{ requirement: string[]; analysis: string[]; confidence: number }> {
  const shared = [
    {
      requirement: ["login", "auth", "authentication", "email", "verification-code", "password", "session"],
      analysis: ["auth", "authentication", "form", "validation", "security", "session", "login"],
      confidence: 0.84
    },
    {
      requirement: ["page", "screen", "ui", "interface", "component", "layout"],
      analysis: ["ui", "component", "route", "frontend", "view", "page"],
      confidence: 0.8
    },
    {
      requirement: ["style", "dark", "minimal", "theme", "visual", "clean"],
      analysis: ["style", "theme", "design", "ui", "visual", "component"],
      confidence: 0.82
    },
    {
      requirement: ["test", "tests", "verify", "verification", "acceptance", "criteria"],
      analysis: ["test", "tests", "verify", "verification", "lint", "build", "manual"],
      confidence: 0.86
    },
    {
      requirement: ["memory", "preference", "pattern", "history", "reuse"],
      analysis: ["memory", "pattern", "reuse", "preference", "assumption", "architecture"],
      confidence: 0.76
    },
    {
      requirement: ["unrelated", "scope", "scoped", "avoid", "forbid", "modify", "constraint"],
      analysis: ["risk", "guard", "constraint", "scoped", "unrelated", "review"],
      confidence: 0.86
    }
  ];

  if (pairType === "Goal <-> Task") {
    return shared.map((group) => ({ ...group, confidence: Math.min(0.9, group.confidence + 0.04) }));
  }
  if (pairType === "Feature <-> Module") {
    return shared;
  }
  if (pairType === "Acceptance <-> Test") {
    return shared.filter((group) => group.requirement.includes("test"));
  }
  if (pairType === "Constraint <-> Risk") {
    return shared.filter((group) => group.requirement.includes("constraint"));
  }
  if (pairType === "Preference <-> Pattern") {
    return shared.filter((group) => group.requirement.includes("style") || group.requirement.includes("memory"));
  }
  return shared;
}

function generalCoverageConfidence(pairType: string): number {
  if (pairType === "Memory <-> Reuse") {
    return 0.62;
  }
  if (pairType === "Feature <-> Module") {
    return 0.6;
  }
  return 0.65;
}

function score(matched: StrandPair[], unmatched: StrandPair[], unknowns: string[]): number {
  const all = [...matched, ...unmatched];
  let earned = 0;
  const total = Object.values(pairWeights).reduce((sum, weight) => sum + weight, 0);
  for (const [pairType, weight] of Object.entries(pairWeights)) {
    const relevant = all.filter((pair) => pair.pair_type === pairType);
    if (relevant.length === 0) {
      continue;
    }
    const confidence = relevant
      .filter((pair) => matched.includes(pair))
      .reduce((sum, pair) => sum + pair.confidence, 0) / relevant.length;
    earned += weight * Math.min(confidence, 1);
  }
  const penalty = Math.min(unknowns.length * 8 + unmatched.length * 8, 45);
  const rawScore = Math.max(0, Math.min(100, Math.round((earned / total) * 100 - penalty)));
  if (unknowns.length >= 3) {
    return Math.min(rawScore, 64);
  }
  if (unknowns.length >= 2) {
    return Math.min(rawScore, 76);
  }
  return rawScore;
}

function warnings(scoreValue: number, unmatched: StrandPair[], missing: string[]): string[] {
  const items: string[] = [];
  if (scoreValue >= 90) {
    items.push("Pairing score is high enough for a complete Codex Task Pack.");
  } else if (scoreValue >= 70) {
    items.push("Task Pack can be generated, but include assumptions, risks, and caution notes.");
  } else {
    items.push("Do not execute directly; clarify missing information first.");
  }
  if (unmatched.length > 0) {
    items.push(`${unmatched.length} requirement item(s) need stronger analysis coverage.`);
  }
  if (missing.length > 0) {
    items.push(`${missing.length} missing information item(s) should be reviewed.`);
  }
  return items;
}
