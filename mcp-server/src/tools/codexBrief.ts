import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { PairingResult } from "../types/pairingResult.js";
import type { ProjectProfile } from "../types/projectProfile.js";
import type { RequirementStrand } from "../types/requirementStrand.js";
import { uniqueStrings } from "./common.js";

export type WorkflowRoute = "tiny" | "simple" | "normal" | "complex" | "high_risk" | "review_only" | "plan_only" | "blocked";

export type CodexIntentType = "implementation" | "plan_only" | "review_only" | "repair" | "documentation" | "unknown";

export interface CodexExecutionBrief {
  objective: string;
  execution_mode: "full" | "cautious" | "blocked";
  intent_type: CodexIntentType;
  workflow_route: WorkflowRoute;
  route_reason: string;
  allowed_scope: string[];
  do_not: string[];
  execution_steps: string[];
  verification: string[];
  review_gate: string;
  markdown: string;
}

export function compileCodexExecutionBrief(input: {
  requirement: RequirementStrand;
  analysis: AnalysisStrand;
  pairing: PairingResult;
  project_profile?: ProjectProfile;
}): CodexExecutionBrief {
  const objective = compact(input.requirement.core_goal || input.requirement.original_request, 220);
  const executionMode = input.pairing.execution_level;
  const allowedScope = allowedScopeFor(input.analysis, input.project_profile);
  const doNot = doNotFor(input.requirement, input.project_profile);
  const executionSteps = executionStepsFor(input.analysis, input.pairing);
  const verification = verificationFor(input.analysis, input.requirement);
  const intentType = inferIntentType(input.requirement, input.analysis);
  const route = routeWorkflow({
    requirement: input.requirement,
    analysis: input.analysis,
    pairing: input.pairing,
    project_profile: input.project_profile,
    intent_type: intentType
  });
  const reviewGate = reviewGateFor(executionMode, route.workflow_route, intentType);

  const markdown = [
    "# Codex Execution Brief",
    "",
    `Objective: ${objective}`,
    `Mode: ${executionMode}`,
    `Intent Type: ${intentType}`,
    `Route: ${route.workflow_route}`,
    `Route Reason: ${route.route_reason}`,
    "",
    "Allowed Scope:",
    bullets(allowedScope),
    "",
    "Do Not:",
    bullets(doNot),
    "",
    "Execution:",
    numbered(executionSteps),
    "",
    "Verification:",
    bullets(verification),
    "",
    "Review Gate:",
    `- ${reviewGate}`
  ].join("\n");

  return {
    objective,
    execution_mode: executionMode,
    intent_type: intentType,
    workflow_route: route.workflow_route,
    route_reason: route.route_reason,
    allowed_scope: allowedScope,
    do_not: doNot,
    execution_steps: executionSteps,
    verification,
    review_gate: reviewGate,
    markdown
  };
}

function routeWorkflow(input: {
  requirement: RequirementStrand;
  analysis: AnalysisStrand;
  pairing: PairingResult;
  project_profile?: ProjectProfile;
  intent_type: CodexIntentType;
}): { workflow_route: WorkflowRoute; route_reason: string } {
  if (input.intent_type === "review_only") {
    return {
      workflow_route: "review_only",
      route_reason: "The request asks CodeDNA to inspect or review output instead of planning new implementation."
    };
  }
  if (input.intent_type === "plan_only") {
    return {
      workflow_route: "plan_only",
      route_reason: "The request explicitly asks for planning, analysis, or no file edits."
    };
  }
  if (input.pairing.execution_level === "blocked" || !input.pairing.ready_for_codex || input.pairing.pairing_score < 70) {
    return {
      workflow_route: "blocked",
      route_reason: "Pairing score or missing information blocks safe Codex execution."
    };
  }
  if (input.pairing.execution_level === "cautious" || hasRiskyScope(input.requirement, input.analysis, input.project_profile)) {
    return {
      workflow_route: "high_risk",
      route_reason: "The task touches protected files, security/privacy boundaries, dependencies, or hard constraints."
    };
  }

  const complexity = complexityScore(input.requirement, input.analysis, input.project_profile);
  if (complexity >= 5) {
    return {
      workflow_route: "complex",
      route_reason: "The task likely spans several files, modules, risks, or verification steps."
    };
  }
  if (isTinyTask(input.requirement, input.analysis, input.project_profile)) {
    return {
      workflow_route: "tiny",
      route_reason: "The task is narrow enough for a direct compact Codex brief."
    };
  }
  if (isSimpleTask(input.analysis)) {
    return {
      workflow_route: "simple",
      route_reason: "The task is scoped to a small number of files and steps."
    };
  }
  return {
    workflow_route: "normal",
    route_reason: "The task is ready for the standard Requirement-Strand to Analysis-Strand CodeDNA handoff."
  };
}

function reviewGateFor(
  executionMode: CodexExecutionBrief["execution_mode"],
  workflowRoute: WorkflowRoute,
  intentType: CodexIntentType
): string {
  if (workflowRoute === "review_only") {
    return "Do not implement new code. Review the provided diff, output, logs, or summary against the original request.";
  }
  if (workflowRoute === "plan_only") {
    return "Do not edit files. Produce the plan, risks, assumptions, and verification strategy only.";
  }
  if (executionMode === "blocked" || workflowRoute === "blocked") {
    return "Do not edit files. Ask the missing clarification questions first.";
  }
  if (workflowRoute === "high_risk") {
    return "Generate guardrails first, keep the diff minimal, and provide changed files, verification evidence, and risk notes for CodeDNA review.";
  }
  if (intentType === "documentation" || workflowRoute === "tiny" || workflowRoute === "simple") {
    return "After editing, provide changed files and concise verification evidence so CodeDNA can confirm the request was satisfied.";
  }
  return "After editing, provide changed files, verification evidence, and residual risks so CodeDNA can review the diff.";
}

function allowedScopeFor(analysis: AnalysisStrand, projectProfile?: ProjectProfile): string[] {
  return uniqueStrings([
    ...analysis.affected_files.slice(0, 10),
    ...analysis.required_modules.slice(0, 5),
    ...(projectProfile?.component_dirs.slice(0, 3) ?? []),
    ...(projectProfile?.api_dirs.slice(0, 3) ?? [])
  ]).slice(0, 12);
}

function doNotFor(requirement: RequirementStrand, projectProfile?: ProjectProfile): string[] {
  const hardConstraints = requirement.constraints.filter((item) =>
    /(do not|don't|never|forbid|forbidden|only|must not|avoid|不要|不能|禁止|只|仅|不得|避免)/iu.test(item)
  );
  return uniqueStrings([
    ...hardConstraints,
    "Do not broaden scope or perform unrelated refactors.",
    "Do not add hardcoded secrets, tokens, API keys, personal paths, or local runtime data.",
    "Do not modify dependency lockfiles, environment files, or generated output unless explicitly required.",
    ...(projectProfile?.do_not_touch.slice(0, 6) ?? [])
  ]).slice(0, 10);
}

function executionStepsFor(analysis: AnalysisStrand, pairing: PairingResult): string[] {
  if (pairing.execution_level === "blocked") {
    return uniqueStrings([
      ...pairing.missing_information.slice(0, 5).map((item) => `Clarify: ${item}`),
      "Do not edit files until the missing information is resolved."
    ]);
  }
  return analysis.implementation_steps.slice(0, 6);
}

function verificationFor(analysis: AnalysisStrand, requirement: RequirementStrand): string[] {
  return uniqueStrings([
    ...analysis.test_plan.slice(0, 5),
    ...requirement.acceptance_criteria.slice(0, 4).map((item) => `Verify acceptance: ${item}`),
    "If a command cannot be run, explain why and provide the closest manual verification."
  ]).slice(0, 8);
}

function hasRiskyScope(requirement: RequirementStrand, analysis: AnalysisStrand, projectProfile?: ProjectProfile): boolean {
  const text = [
    requirement.original_request,
    requirement.constraints.join("\n"),
    requirement.preferences.join("\n"),
    requirement.acceptance_criteria.join("\n"),
    analysis.affected_files.join("\n"),
    analysis.required_modules.join("\n"),
    analysis.risks.join("\n"),
    projectProfile?.dependency_files.join("\n") ?? "",
    projectProfile?.config_files.join("\n") ?? ""
  ].join("\n");
  return /(\.env|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json|vite\.config|next\.config|pyproject\.toml|api key|token|secret|password|privacy|security|dependency|lockfile|environment variable|不要公开|避免.*抄袭|密钥|令牌|隐私|安全|依赖|锁文件|环境变量|配置文件)/iu.test(
    text
  );
}

function complexityScore(requirement: RequirementStrand, analysis: AnalysisStrand, projectProfile?: ProjectProfile): number {
  const text = `${requirement.original_request}\n${analysis.technical_goal}\n${analysis.suggested_architecture.join("\n")}`;
  let score = 0;
  if (analysis.affected_files.length >= 5) score += 2;
  else if (analysis.affected_files.length >= 3) score += 1;
  if (analysis.required_modules.length >= 5) score += 2;
  else if (analysis.required_modules.length >= 3) score += 1;
  if (analysis.implementation_steps.length >= 6) score += 2;
  else if (analysis.implementation_steps.length >= 4) score += 1;
  if (analysis.risks.length >= 4) score += 1;
  if (projectProfile && projectProfile.component_dirs.length + projectProfile.api_dirs.length + projectProfile.test_dirs.length >= 4) score += 1;
  if (/(architecture|migration|multi-file|cross-module|refactor|workflow|complex|架构|迁移|多文件|跨模块|重构|流程|复杂|高难度)/iu.test(text)) {
    score += 2;
  }
  return score;
}

function isTinyTask(requirement: RequirementStrand, analysis: AnalysisStrand, projectProfile?: ProjectProfile): boolean {
  if (projectProfile) {
    return false;
  }
  const text = `${requirement.original_request}\n${requirement.features.join("\n")}`;
  return (
    analysis.affected_files.length <= 1 &&
    analysis.implementation_steps.length <= 2 &&
    /(typo|copy|comment|readme line|one line|small text|错别字|文案|注释|一行|小改)/iu.test(text)
  );
}

function isSimpleTask(analysis: AnalysisStrand): boolean {
  return analysis.affected_files.length <= 2 && analysis.implementation_steps.length <= 3 && analysis.risks.length <= 2;
}

function inferIntentType(requirement: RequirementStrand, analysis: AnalysisStrand): CodexIntentType {
  const text = `${requirement.original_request}\n${requirement.features.join("\n")}\n${analysis.required_modules.join("\n")}`;
  if (/(review-only|review only|only review|audit only|inspect only|审查|审核|复核|只检查|只审查|只做检查|不要继续开发|不要新增功能)/iu.test(text)) {
    return "review_only";
  }
  if (/(plan-only|plan only|planning only|no edits|do not edit|do not change files|只计划|只给方案|只分析|不要改代码|不要改文件|不要编辑文件|先做方案)/iu.test(text)) {
    return "plan_only";
  }
  if (/(repair|fix failure|fix|bug|failed|failure|error|修复|失败|报错|不通过|校验失败)/iu.test(text)) {
    return "repair";
  }
  if (/(readme|docs|documentation|文档|说明|教程)/iu.test(text)) {
    return "documentation";
  }
  if (requirement.features.length || analysis.implementation_steps.length) {
    return "implementation";
  }
  return "unknown";
}

function bullets(items: string[]): string {
  return items.length ? items.map((item) => `- ${compact(item, 180)}`).join("\n") : "- None";
}

function numbered(items: string[]): string {
  return items.length ? items.map((item, index) => `${index + 1}. ${compact(item, 180)}`).join("\n") : "1. No execution step generated.";
}

function compact(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}
