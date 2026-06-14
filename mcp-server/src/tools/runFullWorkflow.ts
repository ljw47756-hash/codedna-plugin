import { stat } from "node:fs/promises";
import type { MemoryStore } from "../storage/memoryStore.js";
import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { PairingResult } from "../types/pairingResult.js";
import type { ProjectGenome } from "../types/projectGenome.js";
import type { ProjectProfile } from "../types/projectProfile.js";
import type { RequirementStrand } from "../types/requirementStrand.js";
import { uniqueStrings } from "./common.js";
import { buildProjectGenome } from "./buildProjectGenome.js";
import { generateTaskPack } from "./generateTaskPack.js";
import { pairStrands } from "./pairStrands.js";
import { parseRequirement } from "./parseRequirement.js";
import { reverseAnalyze } from "./reverseAnalyze.js";
import { scanProject } from "./scanProject.js";

export type FullWorkflowMode = "plan_only" | "task_pack" | "full";

export interface RunFullWorkflowInput {
  user_request: string;
  project_path?: string;
  optional_constraints?: string[] | string;
  mode?: FullWorkflowMode;
  use_project_genome?: boolean;
  use_memory?: boolean;
}

export interface RunFullWorkflowOutput {
  requirement_strand: RequirementStrand;
  analysis_strand: AnalysisStrand;
  pairing_result: PairingResult;
  project_profile?: ProjectProfile;
  project_genome?: ProjectGenome;
  task_pack_path?: string;
  next_action: string;
  clarification_questions: string[];
  warnings: string[];
}

export async function runFullWorkflow(
  input: RunFullWorkflowInput,
  memoryStore: MemoryStore
): Promise<RunFullWorkflowOutput> {
  const mode = input.mode ?? "task_pack";
  const request = buildRequest(input.user_request, input.optional_constraints);
  if (!request.trim()) {
    throw new Error("codedna_run_full_workflow requires user_request.");
  }

  const warnings: string[] = [];
  let projectProfile: ProjectProfile | undefined;
  let projectGenome: ProjectGenome | undefined;

  if (input.project_path) {
    try {
      await assertDirectory(input.project_path);
      projectProfile = (await scanProject({ project_path: input.project_path }, memoryStore)).project_profile;
    } catch (error) {
      warnings.push(`Project scan failed; continuing with generic planning: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push("No project_path was provided; continuing with generic planning.");
  }

  if (input.use_project_genome !== false && input.project_path && projectProfile) {
    try {
      projectGenome = (await buildProjectGenome({ project_path: input.project_path, project_profile: projectProfile }, memoryStore)).project_genome;
    } catch (error) {
      warnings.push(`Project Genome generation failed; continuing without genome: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const loadedMemory = input.use_memory === false ? undefined : await memoryStore.loadSnapshot();
  const parsed = await parseRequirement(
    {
      request,
      project_profile: projectProfile,
      memory_rules: input.use_memory === false ? [] : loadedMemory?.memory.common_project_rules
    },
    memoryStore
  );
  const analysis = await reverseAnalyze(
    {
      requirement_strand: parsed.requirement_strand,
      project_profile: projectProfile
    },
    memoryStore
  );
  const paired = await pairStrands(
    {
      requirement_strand: parsed.requirement_strand,
      analysis_strand: analysis.analysis_strand
    },
    memoryStore
  );
  const highRisk = highRiskRequest(request);
  const pairingResult = adjustedPairing(paired.pairing_result, highRisk);
  warnings.push(...parsed.warnings, ...analysis.warnings, ...pairingResult.warnings);
  warnings.push(...highRisk.warnings);

  let taskPackPath: string | undefined;
  if (mode !== "plan_only" && pairingResult.pairing_score >= 70 && pairingResult.ready_for_codex) {
    const pack = await generateTaskPack(
      {
        requirement_strand: parsed.requirement_strand,
        analysis_strand: analysis.analysis_strand,
        pairing_result: pairingResult,
        project_profile: projectProfile
      },
      memoryStore
    );
    taskPackPath = pack.artifact_path;
  }

  return {
    requirement_strand: parsed.requirement_strand,
    analysis_strand: analysis.analysis_strand,
    pairing_result: pairingResult,
    project_profile: projectProfile,
    project_genome: projectGenome,
    task_pack_path: taskPackPath,
    next_action: nextAction(pairingResult, mode),
    clarification_questions: clarificationQuestions(pairingResult, warnings),
    warnings: uniqueStrings(warnings)
  };
}

function buildRequest(request: string, optionalConstraints?: string[] | string): string {
  const constraints = Array.isArray(optionalConstraints)
    ? optionalConstraints
    : optionalConstraints
      ? [optionalConstraints]
      : [];
  if (constraints.length === 0) {
    return request;
  }
  return `${request.trim()}\n\nAdditional constraints:\n${constraints.map((item) => `- ${item}`).join("\n")}`;
}

async function assertDirectory(path: string): Promise<void> {
  const value = await stat(path);
  if (!value.isDirectory()) {
    throw new Error(`Not a directory: ${path}`);
  }
}

function highRiskRequest(request: string): { severity: "none" | "cautious" | "blocked"; warnings: string[] } {
  const lowered = request.toLowerCase();
  const sensitive = /(\.env|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json|vite\.config|next\.config|pyproject\.toml)/i.test(request);
  const destructive = /\b(delete|remove|wipe|drop|destroy|reset|overwrite|format)\b/i.test(request);
  if (destructive && sensitive) {
    return {
      severity: "blocked",
      warnings: ["High-risk destructive request targets configuration, environment, or package-management files."]
    };
  }
  if (sensitive || /core file|environment variable|dependency lock|package manager/i.test(lowered)) {
    return {
      severity: "cautious",
      warnings: ["High-risk file scope detected; execution must be cautious and guardrails must be generated."]
    };
  }
  return { severity: "none", warnings: [] };
}

function adjustedPairing(pairing: PairingResult, risk: { severity: "none" | "cautious" | "blocked"; warnings: string[] }): PairingResult {
  if (risk.severity === "blocked") {
    return {
      ...pairing,
      pairing_score: Math.min(pairing.pairing_score, 69),
      ready_for_codex: false,
      execution_level: "blocked",
      warnings: uniqueStrings([...pairing.warnings, ...risk.warnings])
    };
  }
  if (risk.severity === "cautious") {
    return {
      ...pairing,
      pairing_score: Math.min(pairing.pairing_score, 89),
      ready_for_codex: pairing.pairing_score >= 70,
      execution_level: pairing.pairing_score >= 70 ? "cautious" : "blocked",
      warnings: uniqueStrings([...pairing.warnings, ...risk.warnings])
    };
  }
  return pairing;
}

function nextAction(pairing: PairingResult, mode: FullWorkflowMode): string {
  if (!pairing.ready_for_codex || pairing.pairing_score < 70) {
    return "Ask clarifying questions before Codex edits files.";
  }
  if (mode === "plan_only") {
    return "Generate guardrails, then decide whether to create a task pack.";
  }
  if (pairing.execution_level === "full") {
    return "Generate guardrails, execute the task pack, then review the diff.";
  }
  return "Generate guardrails and execute cautiously with explicit risk and assumption notes.";
}

function clarificationQuestions(pairing: PairingResult, warnings: string[]): string[] {
  if (pairing.pairing_score >= 70) {
    return [];
  }
  const missing = uniqueStrings([...pairing.missing_information, ...warnings.filter((warning) => /missing|failed|unknown/i.test(warning))]);
  return (missing.length ? missing : ["The task is not specific enough for safe execution."]).map((item) => `Please clarify: ${item}`);
}
