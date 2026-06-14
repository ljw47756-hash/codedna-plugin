import { nowIso, sanitizeFilename } from "../storage/jsonStore.js";
import type { MemoryStore } from "../storage/memoryStore.js";
import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { CodeDnaGuardrails, RiskLevel } from "../types/guardrails.js";
import type { PairingResult } from "../types/pairingResult.js";
import type { ProjectGenome } from "../types/projectGenome.js";
import type { ProjectProfile } from "../types/projectProfile.js";
import type { RequirementStrand } from "../types/requirementStrand.js";
import { uniqueStrings } from "./common.js";
import { extractPathMentions, matchesPathPattern, strictAllowedFilesFromText } from "./diffSafety.js";

export interface GenerateGuardrailsInput {
  requirement_strand: RequirementStrand;
  analysis_strand: AnalysisStrand;
  project_profile?: ProjectProfile;
  project_genome?: ProjectGenome;
  pairing_result?: PairingResult;
  task_id?: string;
  save?: boolean;
}

export interface GenerateGuardrailsOutput {
  guardrails: CodeDnaGuardrails;
  artifact_path?: string;
}

const sensitiveDefaults = [
  ".env",
  ".env.local",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.mjs",
  "pyproject.toml",
  "requirements.txt"
];

export async function generateGuardrails(
  input: GenerateGuardrailsInput,
  memoryStore: MemoryStore
): Promise<GenerateGuardrailsOutput> {
  const taskId = input.task_id ?? `task-${sanitizeFilename(input.requirement_strand.core_goal, "codedna-task")}`;
  const allowedFiles = allowedFilesFor(input);
  const forbiddenFiles = forbiddenFilesFor(input);
  const requiredTests = requiredTestsFor(input);
  const guardrails: CodeDnaGuardrails = {
    guardrail_id: `guardrail-${Date.now()}-${sanitizeFilename(taskId, "task")}`,
    task_id: taskId,
    allowed_files: allowedFiles,
    forbidden_files: forbiddenFiles,
    allowed_operations: [
      "Read project files before editing.",
      "Edit files listed in allowed_files.",
      "Add focused tests or verification notes for changed behavior.",
      "Update Markdown documentation only when directly required by the task."
    ],
    forbidden_operations: [
      "Do not modify forbidden_files.",
      "Do not perform unrelated refactors.",
      "Do not add hardcoded secrets, API keys, tokens, passwords, or local machine paths.",
      "Do not delete important files unless the user explicitly requested deletion.",
      "Do not change package-manager files for UI-only or bug-fix work unless explicitly requested."
    ],
    required_tests: requiredTests,
    required_final_response_format: finalResponseFormat(),
    safety_rules: safetyRules(input, allowedFiles, forbiddenFiles),
    risk_level: riskLevelFor(input),
    generated_at: nowIso()
  };

  let artifactPath: string | undefined;
  if (input.save !== false) {
    artifactPath = await memoryStore.saveArtifact(`guardrails/${sanitizeFilename(guardrails.guardrail_id)}.json`, guardrails);
  }
  return { guardrails, artifact_path: artifactPath };
}

function allowedFilesFor(input: GenerateGuardrailsInput): string[] {
  const requestText = `${input.requirement_strand.original_request}\n${input.requirement_strand.constraints.join("\n")}`;
  const explicitAllowed = uniqueStrings([...strictAllowedFilesFromText(requestText), ...extractPathMentions(requestText)]);
  if (explicitAllowed.length > 0) {
    return explicitAllowed;
  }

  const scoped = /unrelated|scoped|only\s+(?:modify|edit|change|touch)/i.test(requestText);
  const analysisFiles = input.analysis_strand.affected_files.filter((file) => !/scan|inspect|before selecting/i.test(file));
  const genomeZones = input.project_genome?.safe_edit_zones ?? [];
  const profileZones = [
    ...(input.project_profile?.component_dirs ?? []),
    ...(input.project_profile?.api_dirs ?? []),
    ...(input.project_profile?.test_dirs ?? [])
  ];
  const candidates = scoped ? analysisFiles : [...analysisFiles, ...genomeZones, ...profileZones];
  return uniqueStrings(candidates.length ? candidates : ["src/", "app/", "tests/"]).sort();
}

function forbiddenFilesFor(input: GenerateGuardrailsInput): string[] {
  const requestText = input.requirement_strand.original_request;
  const explicitlyMentioned = extractPathMentions(requestText);
  const profileProtected = input.project_profile?.do_not_touch ?? [];
  const genomeForbidden = input.project_genome?.forbidden_zones ?? [];
  const configFiles = input.project_profile?.config_files ?? [];
  const dependencyFiles = input.project_profile?.dependency_files.map((file) => file.path) ?? [];
  const uiTask = /(ui|page|screen|component|style|layout|visual)/i.test(requestText);
  const bugFix = /(bug|fix|error|regression|broken)/i.test(requestText);
  const defaultForbidden = uiTask || bugFix ? [...sensitiveDefaults, ...configFiles, ...dependencyFiles] : sensitiveDefaults;
  return uniqueStrings([...profileProtected, ...genomeForbidden, ...defaultForbidden])
    .filter((file) => !explicitlyMentioned.some((mention) => matchesPathPattern(file, mention)))
    .sort();
}

function requiredTestsFor(input: GenerateGuardrailsInput): string[] {
  const profile = input.project_profile;
  const tests = [...input.analysis_strand.test_plan];
  if (profile?.package_manager === "npm") {
    tests.push("npm test or the closest existing npm verification command");
    tests.push("npm run build when frontend or TypeScript files are changed");
  }
  if (profile?.package_manager === "pnpm") {
    tests.push("pnpm test or the closest existing pnpm verification command");
  }
  if (profile?.language.includes("Python")) {
    tests.push("pytest or the closest existing Python verification command");
  }
  if (!profile || profile.test_dirs.length === 0) {
    tests.push("Focused manual verification steps when automated tests are unavailable");
  }
  return uniqueStrings(tests);
}

function safetyRules(input: GenerateGuardrailsInput, allowedFiles: string[], forbiddenFiles: string[]): string[] {
  return [
    `Allowed files or zones: ${allowedFiles.join(", ") || "none"}.`,
    `Forbidden files or zones: ${forbiddenFiles.join(", ") || "none"}.`,
    "Read before editing and keep the final diff scoped to the task.",
    "If a required edit conflicts with these guardrails, stop and ask for confirmation.",
    "After editing, provide a changed-file summary and verification evidence suitable for codedna_review_diff.",
    ...(input.project_genome ? input.project_genome.recommended_codex_rules.slice(0, 5) : [])
  ];
}

function riskLevelFor(input: GenerateGuardrailsInput): RiskLevel {
  if (input.pairing_result?.execution_level === "blocked" || input.pairing_result?.pairing_score && input.pairing_result.pairing_score < 70) {
    return "high";
  }
  if (input.requirement_strand.constraints.length >= 3 || input.requirement_strand.unknowns.length >= 2) {
    return "medium";
  }
  return "low";
}

function finalResponseFormat(): string {
  return `Summary:
- <what changed>

Files Changed:
- <path>: <reason>

Verification:
- <command or manual check>: <result>

Risks:
- <remaining risk or None>`;
}
