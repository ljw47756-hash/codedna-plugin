import type { MemoryStore } from "../storage/memoryStore.js";
import type { CodeDnaGuardrails, GuardrailsValidation } from "../types/guardrails.js";
import { analyzeDiffRisk, forbiddenTouched, matchesPathPattern, parseChangeSet } from "./diffSafety.js";
import { uniqueStrings } from "./common.js";

export interface ValidateChangesInput {
  guardrails: CodeDnaGuardrails;
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
  const changes = parseChangeSet(input.diff_text ?? "", input.changed_files ?? []);
  const risk = analyzeDiffRisk({
    guardrails: input.guardrails,
    diff_text: input.diff_text,
    changed_files: input.changed_files,
    codex_summary: input.codex_summary
  });
  const touchedForbidden = forbiddenTouched(changes.all_files, input.guardrails.forbidden_files);
  const touchedAllowed = changes.all_files.filter((file) =>
    input.guardrails.allowed_files.some((pattern) => matchesPathPattern(file, pattern))
  );
  const outOfScope = changes.all_files.filter(
    (file) =>
      input.guardrails.allowed_files.length > 0 &&
      !input.guardrails.allowed_files.some((pattern) => matchesPathPattern(file, pattern)) &&
      !touchedForbidden.includes(file)
  );
  const missingRequiredTests = risk.missing_tests.length > 0 ? input.guardrails.required_tests : [];
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
    guardrail_id: input.guardrails.guardrail_id,
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

function repairSuggestion(violations: string[], warnings: string[]): string {
  if (violations.length === 0 && warnings.length === 0) {
    return "No repair needed; proceed to final review.";
  }
  return `Repair only these guardrail findings:
${[...violations, ...warnings].map((item) => `- ${item}`).join("\n")}

Do not reimplement the full feature or broaden the diff.`;
}
