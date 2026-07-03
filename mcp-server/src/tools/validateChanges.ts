import type { MemoryStore } from "../storage/memoryStore.js";
import type { CodeDnaGuardrails, GuardrailsValidation } from "../types/guardrails.js";
import { analyzeDiffRisk, forbiddenTouched, matchesPathPattern, parseChangeSet } from "./diffSafety.js";
import { uniqueStrings } from "./common.js";

export interface ValidateChangesInput {
  guardrails?: CodeDnaGuardrails;
  diff_text?: string;
  changed_files?: string[];
  codex_summary?: string;
  save?: boolean;
}

export type ValidateChangesOutput = GuardrailsValidation;

export async function validateChanges(
  input: ValidateChangesInput,
  _memoryStore: MemoryStore
): Promise<ValidateChangesOutput> {
  if (!input.guardrails) {
    return missingGuardrailsValidation();
  }
  const guardrails = input.guardrails;

  const changes = parseChangeSet(input.diff_text ?? "", input.changed_files ?? []);
  const risk = analyzeDiffRisk({
    guardrails,
    diff_text: input.diff_text,
    changed_files: input.changed_files,
    codex_summary: input.codex_summary
  });
  const touchedForbidden = forbiddenTouched(changes.all_files, guardrails.forbidden_files);
  const touchedAllowed = changes.all_files.filter((file) =>
    guardrails.allowed_files.some((pattern) => matchesPathPattern(file, pattern))
  );
  const outOfScope = changes.all_files.filter(
    (file) =>
      guardrails.allowed_files.length > 0 &&
      !guardrails.allowed_files.some((pattern) => matchesPathPattern(file, pattern)) &&
      !touchedForbidden.includes(file)
  );
  const missingRequiredTests = risk.missing_tests.length > 0 ? guardrails.required_tests : [];
  const violations = uniqueStrings([
    ...touchedForbidden.map((file) => `Forbidden file touched: ${file}`),
    ...risk.dangerous_commands.map((item) => `Dangerous command: ${item}`),
    ...risk.hardcoded_secrets.map((item) => `Hardcoded secret: ${item}`),
    ...risk.changes.deleted_files.map((file) => `Important file deleted or removed: ${file}`),
    ...outOfScope.map((file) => `File outside allowed scope: ${file}`)
  ]);
  const warnings = uniqueStrings([
    risk.large_unrequested_refactor ? "Large unrequested refactor detected." : "",
    ...risk.missing_tests,
    ...risk.architecture_risks,
    ...risk.performance_risks
  ]);
  const finalVerdict = violations.some((violation) => /dangerous|secret|deleted/i.test(violation))
    ? "blocked"
    : violations.length > 0
      ? "needs_fix"
      : warnings.length > 0
        ? "pass_with_warnings"
        : "pass";

  return {
    guardrail_id: guardrails.guardrail_id,
    validation_passed: finalVerdict === "pass",
    violations,
    warnings,
    touched_allowed_files: touchedAllowed,
    touched_forbidden_files: touchedForbidden,
    missing_required_tests: uniqueStrings(missingRequiredTests),
    final_verdict: finalVerdict,
    repair_suggestion: repairSuggestion(violations, warnings)
  };
}

function missingGuardrailsValidation(): ValidateChangesOutput {
  return {
    guardrail_id: "missing-guardrails",
    validation_passed: false,
    violations: ["Missing required CodeDNA input: guardrails."],
    warnings: [
      "Run codedna_parse_requirement, codedna_reverse_analyze, codedna_pair_strands, and codedna_generate_guardrails before validating changes."
    ],
    touched_allowed_files: [],
    touched_forbidden_files: [],
    missing_required_tests: [],
    final_verdict: "blocked",
    repair_suggestion:
      "Cannot validate changes without CodeDNA guardrails. Call codedna_generate_guardrails with the Requirement Strand and Analysis Strand, then call codedna_validate_changes again with the generated guardrails."
  };
}

function repairSuggestion(violations: string[], warnings: string[]): string {
  if (violations.length === 0 && warnings.length === 0) {
    return "No repair needed; proceed to final review.";
  }
  return `Repair only these guardrail findings:
${[...violations, ...warnings].map((item) => `- ${item}`).join("\n")}

Do not reimplement the full feature or broaden the diff.`;
}
