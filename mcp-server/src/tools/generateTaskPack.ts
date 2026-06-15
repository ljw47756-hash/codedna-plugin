import { sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
import type { MemoryStore } from "../storage/memoryStore.js";
import type { AnalysisStrand } from "../types/analysisStrand.js";
import type { ActivatedEffect, CodexAssistanceStep, PairingResult, RecalledCase, StrandPair } from "../types/pairingResult.js";
import type { ProjectProfile } from "../types/projectProfile.js";
import type { RequirementStrand } from "../types/requirementStrand.js";
import { uniqueStrings } from "./common.js";

export interface GenerateTaskPackInput {
  requirement_strand: RequirementStrand;
  analysis_strand: AnalysisStrand;
  pairing_result: PairingResult;
  project_profile?: ProjectProfile;
  save?: boolean;
}

export interface GenerateTaskPackOutput {
  codex_task_pack: {
    task_id: string;
    markdown: string;
    readiness: {
      pairing_score: number;
      execution_level: string;
      ready_for_codex: boolean;
      gate_note: string;
    };
  };
  artifact_path?: string;
}

export async function generateTaskPack(
  input: GenerateTaskPackInput,
  memoryStore: MemoryStore
): Promise<GenerateTaskPackOutput> {
  const taskId = artifactId("codedna-task", input.requirement_strand.created_at, input.requirement_strand.core_goal);
  const markdown = renderTaskPack(input, taskId);
  let artifactPath: string | undefined;
  if (input.save !== false) {
    artifactPath = await memoryStore.saveMarkdown(
      `tasks/${timestampedName(input.requirement_strand.core_goal, ".codex_task.md")}`,
      markdown
    );
  }
  return {
    codex_task_pack: {
      task_id: taskId,
      markdown,
      readiness: {
        pairing_score: input.pairing_result.pairing_score,
        execution_level: input.pairing_result.execution_level,
        ready_for_codex: input.pairing_result.ready_for_codex,
        gate_note: statusNote(input.pairing_result)
      }
    },
    artifact_path: artifactPath
  };
}

function renderTaskPack(input: GenerateTaskPackInput, taskId: string): string {
  const requirement = input.requirement_strand;
  const analysis = input.analysis_strand;
  const pairing = input.pairing_result;
  return `# Codex Task Pack

Task ID: ${taskId}

## Execution Gate

- Pairing Score: ${pairing.pairing_score}
- Execution Level: ${pairing.execution_level}
- Ready for Codex: ${pairing.ready_for_codex ? "yes" : "no"}
- Gate note: ${statusNote(pairing)}
${pairing.pairing_score < 70 ? "\n**Do not execute this task directly. Clarify the missing information before asking Codex to edit files.**\n" : ""}

## CodeDNA Core Chain

\`\`\`text
用户需求链
    <-> 配对审查
反向解析链
    ↓
Codex 任务包
    ↓
代码执行
    ↓
反向审查
    ↓
记忆进化
\`\`\`

${pairing.dna_alignment ? `- Requirement Strand: ${pairing.dna_alignment.requirement_strand}
- Pairing Review: ${pairing.dna_alignment.pairing_review}
- Analysis Strand: ${pairing.dna_alignment.analysis_strand}
- Execution Layer: ${pairing.dna_alignment.execution_layer}
- Feedback Layer: ${pairing.dna_alignment.feedback_layer}
- Evolution Layer: ${pairing.dna_alignment.evolution_layer}
- Gate Status: ${pairing.dna_alignment.gate_status}` : "- DNA alignment metadata is not available."}

## Score Evidence

${bullets(pairing.score_explanation ?? [])}

## Activated CodeDNA Effects

${effects(pairing.activated_effects ?? [])}

## Relevant Success Patterns

${recalledCases(pairing.case_recall?.success_patterns ?? [])}

## Relevant Failure Patterns

${recalledCases(pairing.case_recall?.failure_patterns ?? [])}

## Codex Assistance Handoff

${codexAssistance(pairing.codex_assistance ?? [])}

## Original User Request

${requirement.original_request}

## Requirement Strand Summary

\`\`\`json
${JSON.stringify(requirement, null, 2)}
\`\`\`

## Analysis Strand Summary

\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

## Project Profile Summary

${projectContext(input.project_profile)}

## Allowed Files

${bullets(analysis.affected_files)}

## Forbidden Files

${bullets(forbiddenScope(requirement, input.project_profile))}

## Missing Information

${bullets(pairing.missing_information)}

## Implementation Plan

${numbered(analysis.implementation_steps)}

## Architecture Guidance

${bullets(analysis.suggested_architecture)}

## Risks

${bullets(analysis.risks)}

## Assumptions

${bullets(analysis.assumptions)}

## Acceptance Criteria

${bullets(requirement.acceptance_criteria)}

## Test Plan

${bullets(analysis.test_plan)}

## Rollback Plan

${bullets(analysis.rollback_plan)}

## Pairing Review

### Matched Pairs

${pairs(pairing.matched_pairs)}

### Unmatched Or Weak Pairs

${pairing.unmatched_pairs.length ? pairs(pairing.unmatched_pairs) : "- None"}

## Codex Self Check

- Confirm the final diff only touches files needed for this task.
- Confirm every user constraint is addressed explicitly.
- Confirm the output followed the CodeDNA chain: requirement strand, pairing review, reverse analysis, execution, reverse review, memory proposal when appropriate.
- Run verification commands or explain why they cannot be run.
- Summarize changed files, behavior, tests, and residual risks.
- Do not claim completion without evidence from inspection or verification.

## Required Final Response Format

\`\`\`markdown
Summary:
- <what changed>

Verification:
- <command or manual check and result>

Files Changed:
- <path>: <reason>

Risks / Follow-ups:
- <remaining issue or 'None'>
\`\`\`
`;
}

function statusNote(pairing: PairingResult): string {
  if (pairing.pairing_score >= 90) {
    return "Generate and execute the task pack normally.";
  }
  if (pairing.pairing_score >= 70) {
    return "Generate the task pack with assumptions and risk notes attached.";
  }
  return "Direct execution is blocked. Use this pack to gather missing information before implementation.";
}

function projectContext(projectProfile?: ProjectProfile): string {
  if (!projectProfile) {
    return "- No project profile is available. Run codedna_scan_project before editing.";
  }
  return [
    `- Project path: ${projectProfile.project_path}`,
    `- Languages: ${projectProfile.language.join(", ") || "unknown"}`,
    `- Frameworks: ${projectProfile.framework.join(", ") || "none detected"}`,
    `- Package manager: ${projectProfile.package_manager}`,
    `- Entry points: ${projectProfile.entry_points.join(", ") || "none detected"}`,
    `- Component directories: ${projectProfile.component_dirs.join(", ") || "none detected"}`,
    `- API directories: ${projectProfile.api_dirs.join(", ") || "none detected"}`,
    `- Test directories: ${projectProfile.test_dirs.join(", ") || "none detected"}`
  ].join("\n");
}

function forbiddenScope(requirement: RequirementStrand, projectProfile?: ProjectProfile): string[] {
  return uniqueStrings([
    "Unrelated refactors",
    "Generated dependency lockfile changes unless required by the task",
    "Secrets, environment files, and local machine configuration",
    ...requirement.constraints,
    ...(projectProfile?.do_not_touch.slice(0, 20) ?? [])
  ]);
}

function bullets(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function numbered(items: string[]): string {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : "1. No steps generated.";
}

function pairs(items: StrandPair[]): string {
  if (items.length === 0) {
    return "- None";
  }
  return items
    .map((item) => `- **${item.pair_type}** \`${item.status}\` (${item.confidence.toFixed(2)}): ${item.requirement_item} -> ${item.analysis_item || "missing"}`)
    .join("\n");
}

function effects(items: ActivatedEffect[]): string {
  if (items.length === 0) {
    return "- None";
  }
  return items
    .map((item) => `- **${item.effect_family}** -> ${item.pair_type} (weight ${item.weight}): ${item.codedna_pattern} Guardrail: ${item.guardrail}`)
    .join("\n");
}

function recalledCases(items: RecalledCase[]): string {
  if (items.length === 0) {
    return "- None";
  }
  return items
    .map((item) => `- **${item.id}** (${item.outcome}, score ${item.score}): ${item.codedna_pattern} Guardrail: ${item.guardrail}`)
    .join("\n");
}

function codexAssistance(items: CodexAssistanceStep[]): string {
  if (items.length === 0) {
    return "- Use Codex to implement only after the task pack and guardrails are reviewed.";
  }
  return items
    .map((item) => `- **${item.stage}**: ${item.codex_role} Prompt: ${item.prompt} Expected output: ${item.expected_output}`)
    .join("\n");
}

function artifactId(prefix: string, createdAt: string, label: string): string {
  const stamp = (createdAt || new Date().toISOString())
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[^\dTZ]/g, "");
  return `${prefix}-${stamp}-${sanitizeFilename(label, "task")}`.slice(0, 140);
}
