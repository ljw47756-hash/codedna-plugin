import { sanitizeFilename, timestampedName } from "../storage/jsonStore.js";
export async function reviewCodexOutput(input, memoryStore) {
    const modifiedFiles = modifiedFilesFromText(input.codex_output);
    const deletedFiles = deletedFilesFromText(input.codex_output);
    const checks = reviewChecks(input, modifiedFiles, deletedFiles);
    const verdict = finalVerdict(checks);
    const nextPrompt = nextFixPrompt(input.requirement_strand, checks);
    const reviewId = artifactId("codedna-review", input.requirement_strand.created_at, input.requirement_strand.core_goal);
    const markdown = renderReview(input, reviewId, verdict, checks, modifiedFiles, nextPrompt);
    let artifactPath;
    if (input.save !== false) {
        artifactPath = await memoryStore.saveMarkdown(`reviews/${timestampedName(input.requirement_strand.core_goal, ".review.md")}`, markdown);
    }
    return {
        review_report: {
            review_id: reviewId,
            verdict,
            checks,
            modified_files: modifiedFiles,
            markdown,
            next_codex_fix_prompt: nextPrompt
        },
        artifact_path: artifactPath
    };
}
function modifiedFilesFromText(text) {
    const files = new Set();
    for (const line of text.split(/\r?\n/)) {
        const patterns = [
            /^diff --git a\/(.+?) b\/(.+)$/,
            /^\+\+\+ b\/(.+)$/,
            /^--- a\/(.+)$/,
            /^\s*(?:modified|created|deleted):\s+(.+)$/i,
            /^\s*[-*]\s+([\w./\\-]+\.\w+):/
        ];
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                files.add((match[2] ?? match[1]).trim().replace(/\\/g, "/"));
            }
        }
    }
    return [...files].filter((file) => file && file !== "/dev/null").sort();
}
function deletedFilesFromText(text) {
    const files = new Set();
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const explicit = line.match(/^\s*(?:deleted|removed):\s+(.+)$/i);
        if (explicit) {
            files.add(explicit[1].trim().replace(/\\/g, "/"));
        }
        const diff = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        if (diff && /deleted file mode/i.test(lines.slice(index, index + 5).join("\n"))) {
            files.add(diff[2].trim().replace(/\\/g, "/"));
        }
        const plusDevNull = line.match(/^\+\+\+ \/dev\/null/);
        const minusFile = lines[index - 1]?.match(/^--- a\/(.+)$/);
        if (plusDevNull && minusFile) {
            files.add(minusFile[1].trim().replace(/\\/g, "/"));
        }
    }
    return [...files].sort();
}
function reviewChecks(input, modifiedFiles, deletedFiles) {
    const lowered = input.codex_output.toLowerCase();
    const forbidden = forbiddenFileChanges(input, modifiedFiles);
    const dangerous = dangerousCommand(input.codex_output);
    const apiKey = plaintextApiKey(input.codex_output);
    const deleted = deletedImportantFiles(input, deletedFiles);
    const broadRefactor = broadRefactorRisk(input, modifiedFiles);
    const mismatch = requirementMismatch(input, lowered);
    const testGap = !/(test|pytest|passed|verification|verify|lint|build)/i.test(input.codex_output);
    const assumptionsMissing = !/(assumption|assume|assumed|known limitation|risk)/i.test(input.codex_output);
    return [
        {
            name: "Requirement Match",
            status: mismatch ? "fail" : "pass",
            detail: mismatch || "Result explicitly mentions or demonstrates the requested behavior.",
            severity: mismatch ? "medium" : "low"
        },
        {
            name: "Constraint Violations",
            status: constraintRisk(input.requirement_strand, lowered) ? "fail" : "pass",
            detail: constraintRisk(input.requirement_strand, lowered) || "No obvious constraint violation detected.",
            severity: constraintRisk(input.requirement_strand, lowered) ? "high" : "low"
        },
        {
            name: "Forbidden File Changes",
            status: forbidden.length > 0 ? "fail" : "pass",
            detail: forbidden.length > 0 ? `Forbidden or out-of-scope files changed: ${forbidden.join(", ")}` : "No forbidden file change detected.",
            severity: forbidden.length > 0 ? "high" : "low"
        },
        {
            name: "Deleted Important Files",
            status: deleted.length > 0 ? "fail" : "pass",
            detail: deleted.length > 0 ? `Important files appear deleted: ${deleted.join(", ")}` : "No important file deletion detected.",
            severity: deleted.length > 0 ? "high" : "low"
        },
        {
            name: "Unrelated File Changes",
            status: filesAreScoped(modifiedFiles, input.analysis_strand, input.project_profile) ? "pass" : "review",
            detail: "Modified files should stay within recommended areas or be justified.",
            severity: "medium"
        },
        {
            name: "Architecture Risks",
            status: broadRefactor ? "fail" : /(hack|temporary|workaround|monolith|quick fix)/i.test(input.codex_output) ? "review" : "pass",
            detail: broadRefactor || "Watch for temporary language, monolithic changes, or unexplained architecture shifts.",
            severity: broadRefactor ? "medium" : "medium"
        },
        {
            name: "Security Risks",
            status: /(hardcoded password|secret|token=|eval\(|shell\s*:\s*true)/i.test(input.codex_output) ? "fail" : "pass",
            detail: "No obvious security red flag found in the pasted result.",
            severity: /(hardcoded password|secret|token=|eval\(|shell\s*:\s*true)/i.test(input.codex_output) ? "high" : "low"
        },
        {
            name: "Dangerous Command",
            status: dangerous ? "fail" : "pass",
            detail: dangerous || "No dangerous command pattern detected.",
            severity: dangerous ? "high" : "low"
        },
        {
            name: "Plaintext API Key",
            status: apiKey ? "fail" : "pass",
            detail: apiKey || "No plaintext API key pattern detected.",
            severity: apiKey ? "high" : "low"
        },
        {
            name: "Performance Risks",
            status: /(slow|timeout|blocking|o\(n\^2\)|memory leak)/i.test(input.codex_output) ? "review" : "pass",
            detail: "No obvious performance warning found in the pasted result.",
            severity: "medium"
        },
        {
            name: "Test Gaps",
            status: testGap ? "review" : "pass",
            detail: testGap ? "Result does not include tests or clear manual verification evidence." : "Result includes tests or verification evidence.",
            severity: "medium"
        },
        {
            name: "Assumptions Missing",
            status: assumptionsMissing ? "review" : "pass",
            detail: assumptionsMissing ? "Result does not explain assumptions, risks, or known limitations." : "Result includes assumptions, risks, or known limitations.",
            severity: "low"
        }
    ];
}
function importantTerms(text) {
    const words = text.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? [];
    return words.slice(0, 12);
}
function constraintRisk(requirement, lowered) {
    for (const constraint of requirement.constraints) {
        const lowerConstraint = constraint.toLowerCase();
        if (/(do not|don't|never|forbid|forbidden|must not|avoid)/iu.test(lowerConstraint) && /(ignored|unrelated|refactor|skipped constraint)/i.test(lowered)) {
            return `Potential violation of constraint: ${constraint}`;
        }
    }
    return "";
}
function filesAreScoped(modifiedFiles, analysis, projectProfile) {
    if (modifiedFiles.length === 0) {
        return true;
    }
    const protectedFiles = new Set(projectProfile?.do_not_touch ?? []);
    if (modifiedFiles.some((file) => protectedFiles.has(file))) {
        return false;
    }
    const allowed = analysis.affected_files.filter(Boolean);
    if (allowed.length === 0) {
        return true;
    }
    return modifiedFiles.every((file) => {
        if (allowed.includes(file)) {
            return true;
        }
        if (allowed.some((area) => file.startsWith(`${area.replace(/\/$/, "")}/`))) {
            return true;
        }
        return /(test|spec|README|docs)/i.test(file);
    });
}
function nextFixPrompt(requirement, checks) {
    const failing = checks.filter((check) => check.status !== "pass");
    if (failing.length === 0) {
        return "No fix prompt is required. The submitted result appears ready after final human review.";
    }
    const bullets = failing.map((check) => `- ${check.name}: ${check.detail}`).join("\n");
    return `Please revise the previous implementation for this request:

${requirement.original_request}

Address these CodeDNA review findings without changing unrelated files:
${bullets}

Return a concise summary, changed files, and verification evidence.`;
}
function renderReview(input, reviewId, verdict, checks, modifiedFiles, nextPrompt) {
    const byName = (name) => checks.find((check) => check.name === name) ?? {
        name,
        status: "review",
        detail: "No check result was produced.",
        severity: "medium"
    };
    const requiredFixes = checks.filter((check) => check.status !== "pass");
    return `# CodeDNA Review Report

Review ID: ${reviewId}

## Original Requirement

${input.requirement_strand.original_request}

## Codex Output Summary

${codexOutputSummary(input.codex_output)}

## Requirement Match

${checkBlock(byName("Requirement Match"))}

## Constraint Violations

${checkBlock(byName("Constraint Violations"))}

## Unrelated File Changes

${modifiedFiles.length ? modifiedFiles.map((file) => `- ${file}`).join("\n") : "- None detected"}

${checkBlock(byName("Unrelated File Changes"))}

## Forbidden File Changes

${checkBlock(byName("Forbidden File Changes"))}

## Deleted Important Files

${checkBlock(byName("Deleted Important Files"))}

## Architecture Risks

${checkBlock(byName("Architecture Risks"))}

## Security Risks

${checkBlock(byName("Security Risks"))}

## Dangerous Command

${checkBlock(byName("Dangerous Command"))}

## Plaintext API Key

${checkBlock(byName("Plaintext API Key"))}

## Performance Risks

${checkBlock(byName("Performance Risks"))}

## Test Gaps

${checkBlock(byName("Test Gaps"))}

## Assumptions Missing

${checkBlock(byName("Assumptions Missing"))}

## Required Fixes

${requiredFixes.length ? requiredFixes.map((check) => `- ${check.name}: ${check.detail}`).join("\n") : "- None"}

## Review Check Table

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((check) => `| ${check.name} | ${check.status} | ${check.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## Next Codex Repair Prompt

\`\`\`markdown
${nextPrompt}
\`\`\`

## Final Verdict

${verdict}
`;
}
function checkBlock(check) {
    return `- Status: ${check.status}\n- Severity: ${check.severity}\n- Detail: ${check.detail}`;
}
function codexOutputSummary(output) {
    const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("diff --git"))
        .slice(0, 8);
    return lines.length ? lines.map((line) => `- ${line.replace(/^\s*[-*]\s*/, "")}`).join("\n") : "- No summary text was provided.";
}
function artifactId(prefix, createdAt, label) {
    const stamp = (createdAt || new Date().toISOString())
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z")
        .replace(/[^\dTZ]/g, "");
    return `${prefix}-${stamp}-${sanitizeFilename(label, "review")}`.slice(0, 140);
}
function finalVerdict(checks) {
    if (checks.some((check) => check.status === "fail" && check.severity === "high")) {
        return "blocked";
    }
    if (checks.some((check) => check.status === "fail")) {
        return "needs_fix";
    }
    if (checks.some((check) => check.status === "review")) {
        return "pass_with_warnings";
    }
    return "pass";
}
function requirementMismatch(input, loweredOutput) {
    const terms = importantTerms(input.requirement_strand.core_goal);
    return terms.some((term) => loweredOutput.includes(term)) ? "" : "Implementation summary does not match key Requirement Strand terms.";
}
function forbiddenFileChanges(input, modifiedFiles) {
    const protectedPatterns = input.project_profile?.do_not_touch ?? [];
    const strictAllowed = strictAllowedFiles(input.requirement_strand.constraints);
    return modifiedFiles.filter((file) => {
        if (protectedPatterns.some((pattern) => matchesPathPattern(file, pattern))) {
            return true;
        }
        if (strictAllowed.length > 0 && !strictAllowed.some((allowed) => matchesPathPattern(file, allowed))) {
            return true;
        }
        return false;
    });
}
function strictAllowedFiles(constraints) {
    const results = [];
    for (const constraint of constraints) {
        const match = constraint.match(/\bonly\s+(?:modify|edit|change)\s+([A-Za-z0-9_./\\-]+)/i);
        if (match) {
            results.push(match[1].replace(/\\/g, "/").replace(/[.,;:]$/g, ""));
        }
    }
    return results;
}
function matchesPathPattern(file, pattern) {
    const normalizedFile = file.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
    if (normalizedPattern.endsWith("/")) {
        return normalizedFile.startsWith(normalizedPattern.replace(/\/$/, ""));
    }
    return normalizedFile === normalizedPattern || normalizedFile.endsWith(`/${normalizedPattern}`);
}
function deletedImportantFiles(input, deletedFiles) {
    return deletedFiles.filter((file) => {
        if (input.analysis_strand.affected_files.some((affected) => matchesPathPattern(file, affected))) {
            return true;
        }
        if (input.project_profile?.do_not_touch.some((protectedPath) => matchesPathPattern(file, protectedPath))) {
            return true;
        }
        return /(^|\/)(package\.json|tsconfig\.json|pyproject\.toml|requirements\.txt|main\.[jt]s|main\.py)$/i.test(file);
    });
}
function dangerousCommand(output) {
    const patterns = [
        /\brm\s+-rf\s+(?:\/|\.|~|\*)/i,
        /\bdel\s+\/[fsq]/i,
        /\bRemove-Item\b.+\b-Recurse\b.+\b-Force\b/i,
        /\bInvoke-Expression\b|\biex\b/i,
        /\bcurl\b.+\|\s*(?:bash|sh|powershell)/i,
        /\bchild_process\.(?:exec|execSync)\b/i,
        /\bshell\s*:\s*true\b/i,
        /\beval\s*\(/i
    ];
    const found = patterns.find((pattern) => pattern.test(output));
    return found ? `Dangerous command pattern detected: ${found.source}` : "";
}
function plaintextApiKey(output) {
    const patterns = [
        /\b[A-Z0-9_]*API[_-]?KEY\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
        /\bsk-[A-Za-z0-9_-]{12,}/,
        /\bghp_[A-Za-z0-9_]{12,}/,
        /\bxox[baprs]-[A-Za-z0-9-]{12,}/
    ];
    const found = patterns.find((pattern) => pattern.test(output));
    return found ? `Plaintext API key or token pattern detected: ${found.source}` : "";
}
function broadRefactorRisk(input, modifiedFiles) {
    const requestedRefactor = /refactor|restructure|reorganize|architecture/i.test(input.requirement_strand.original_request);
    if (!requestedRefactor && /broad refactor|large refactor|restructure|rewrote|reorganized/i.test(input.codex_output)) {
        return "Output describes a broad refactor that was not requested.";
    }
    if (!requestedRefactor && modifiedFiles.length > 8) {
        return `Output changed ${modifiedFiles.length} files without a refactor request.`;
    }
    return "";
}
