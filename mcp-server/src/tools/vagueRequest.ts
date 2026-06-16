import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { RequirementStrand } from "../types/requirementStrand.js";

export const vagueClarificationQuestions = [
  "What specific area should be improved?",
  "Which files, modules, or features are in scope?",
  "What should not be changed?",
  "What acceptance criteria should determine success?",
  "Should this be documentation, UI, performance, testing, refactor, bug fix, or architecture work?"
];

const genericImprovementPatterns = [
  /\bmake\s+(?:the\s+|this\s+)?project\s+better\b/i,
  /\bimprove\s+this\s+project\b/i,
  /\boptimi[sz]e\s+(?:the\s+)?code\b/i,
  /\brefactor\s+(?:this\s+project|everything)\b/i,
  /\bmake\s+it\s+cleaner\b/i,
  /\bfix\s+everything\b/i,
  /\bmake\s+it\s+production\s+ready\b/i,
  /\bimprove\s+performance\b/i,
  /\bmake\s+the\s+ui\s+better\b/i,
  /随便你发挥/u,
  /把项目做好/u,
  /修复所有问题/u,
  /优化整个项目/u,
  /重构所有代码/u,
  /把界面做好看一点/u
];

const metaInstructionPatterns = [
  /\bcodedna_run_full_workflow\b/i,
  /\brequirement\s+strand\b/i,
  /\banalysis\s+strand\b/i,
  /\bpairing\s+result\b/i,
  /\btask\s+pack\b/i,
  /\bartifact\s+paths?\b/i,
  /\bready_for_codex\b/i,
  /\bexecution_level\b/i,
  /\bpairing_score\b/i
];

export interface VagueRequestGate {
  is_vague: boolean;
  evidence_count: number;
  missing_categories: string[];
  clarification_questions: string[];
  warnings: string[];
}

export function isGenericImprovementText(value: string): boolean {
  return genericImprovementPatterns.some((pattern) => pattern.test(value));
}

export function isMetaWorkflowInstruction(value: string): boolean {
  return metaInstructionPatterns.some((pattern) => pattern.test(value));
}

export function isGenericImprovementFeature(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  return (
    isGenericImprovementText(normalized) ||
    /^(improve|optimi[sz]e|refactor|fix|clean up|make better)\b/i.test(normalized) ||
    /^(优化|重构|修复).*(整个|所有|全部|项目)/u.test(normalized)
  );
}

export function evaluateVagueRequest(requirement: RequirementStrand, analysis?: AnalysisStrand): VagueRequestGate {
  const request = requirement.original_request;
  const genericGoal = isGenericImprovementText(request) || isGenericImprovementText(requirement.core_goal);
  const categories = {
    concrete_goal: hasConcreteGoal(requirement),
    scope: hasConcreteScope(requirement, analysis),
    acceptance: hasExplicitAcceptance(request, requirement),
    constraints: hasExplicitConstraints(requirement),
    tests: hasTestMethod(request),
    problem: hasProblemEvidence(request)
  };
  const evidenceCount = Object.values(categories).filter(Boolean).length;
  const missingCategories = Object.entries(categories)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  const onlyGenericFeatures =
    requirement.features.length === 0 ||
    requirement.features.every((feature) => isGenericImprovementFeature(feature) || isMetaWorkflowInstruction(feature));
  const isVague = genericGoal && (evidenceCount < 2 || onlyGenericFeatures);
  return {
    is_vague: isVague,
    evidence_count: evidenceCount,
    missing_categories: missingCategories,
    clarification_questions: isVague ? vagueClarificationQuestions : [],
    warnings: isVague
      ? [
          "Vague improvement request detected; direct execution is blocked until the user clarifies goal, scope, constraints, acceptance criteria, and work type."
        ]
      : []
  };
}

function hasConcreteGoal(requirement: RequirementStrand): boolean {
  const nonGenericFeatures = requirement.features.filter(
    (feature) => !isGenericImprovementFeature(feature) && !isMetaWorkflowInstruction(feature)
  );
  if (nonGenericFeatures.length > 0) {
    return true;
  }
  return !isGenericImprovementText(requirement.core_goal) && !isMetaWorkflowInstruction(requirement.core_goal);
}

function hasConcreteScope(requirement: RequirementStrand, analysis?: AnalysisStrand): boolean {
  const text = `${requirement.original_request}\n${requirement.core_goal}\n${requirement.features.join("\n")}`;
  const requestScope = /\b(?:readme|docs?|[\w.-]+\.(?:ts|tsx|js|jsx|json|md|css|py|yml|yaml)|src[\\/]|mcp-server[\\/]|component|route|api|module|file|directory|quick start|login|checkout|dashboard)\b/i.test(
    text
  );
  if (requestScope) {
    return true;
  }
  const affected = analysis?.affected_files ?? [];
  return affected.length > 0 && !affected.some((file) => /inspect project structure|scan the target project/i.test(file));
}

function hasExplicitAcceptance(request: string, requirement: RequirementStrand): boolean {
  if (/\b(?:acceptance|criteria|expected|verify|verification|test|passes?|should|must be able|done when|success)\b/i.test(request)) {
    return true;
  }
  return requirement.acceptance_criteria.some((criterion) => !/^Implemented behavior matches|^Each requested feature|^All listed constraints|^Relevant verification/i.test(criterion));
}

function hasExplicitConstraints(requirement: RequirementStrand): boolean {
  return requirement.constraints.length > 0;
}

function hasTestMethod(request: string): boolean {
  return /\b(?:npm\s+(?:test|run\s+\w+)|pytest|vitest|jest|lint|build|smoke|release:check|manual check|verification)\b/i.test(request);
}

function hasProblemEvidence(request: string): boolean {
  return /\b(?:error|failure|failing|bug|regression|stack trace|log|exception|crash|timeout|slow|latency|memory leak|reproduce)\b/i.test(
    request
  );
}
