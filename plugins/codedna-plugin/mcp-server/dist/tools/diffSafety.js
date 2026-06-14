import { uniqueStrings } from "./common.js";
const dangerousCommandPatterns = [
    [/\brm\s+-rf\s+(?:\/|~|\.|\*)/i, "Potential recursive delete command."],
    [/\bRemove-Item\b[^\n]*\b-Recurse\b[^\n]*\b-Force\b/i, "Potential forced recursive PowerShell delete."],
    [/\bdel\s+\/[fsq]/i, "Potential forced Windows delete command."],
    [/\bformat\s+[a-z]:/i, "Potential disk format command."],
    [/\bmkfs\./i, "Potential filesystem formatting command."],
    [/\bInvoke-Expression\b|\biex\b/i, "Dynamic PowerShell execution."],
    [/\bcurl\b[^\n|]*\|\s*(?:bash|sh|powershell)/i, "Downloaded script piped to shell."],
    [/\bchild_process\.(?:exec|execSync)\b/i, "Node child_process exec usage."],
    [/\bshell\s*:\s*true\b/i, "Shell execution enabled."],
    [/\beval\s*\(/i, "Dynamic eval usage."]
];
const apiKeyPatterns = [
    [/\bsk-[A-Za-z0-9_-]{12,}/, "OpenAI-style API key pattern."],
    [/\bghp_[A-Za-z0-9_]{12,}/, "GitHub token pattern."],
    [/\bxox[baprs]-[A-Za-z0-9-]{12,}/, "Slack token pattern."],
    [/\bAIza[0-9A-Za-z_-]{16,}/, "Google API key pattern."]
];
const secretPatterns = [
    [/\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{10,}/i, "Hardcoded secret assignment."],
    [/\b(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i, "Hardcoded credential value."]
];
export function analyzeDiffRisk(input) {
    const originalRequest = input.original_request || input.requirement_strand?.original_request || "";
    const changes = parseChangeSet(input.diff_text ?? "", input.changed_files ?? []);
    const combinedText = `${input.diff_text ?? ""}\n${input.codex_summary ?? ""}`;
    const forbiddenFilesTouched = forbiddenTouched(changes.all_files, input.guardrails?.forbidden_files ?? []);
    const unrelatedChanges = unrelatedChangedFiles(changes.all_files, originalRequest, input.analysis_strand, input.guardrails);
    const dangerousCommands = findPatternLabels(combinedText, dangerousCommandPatterns);
    const apiKeys = findPatternLabels(combinedText, apiKeyPatterns);
    const hardcodedSecrets = uniqueStrings([...findPatternLabels(combinedText, secretPatterns), ...apiKeys]);
    const largeRefactor = isLargeUnrequestedRefactor(originalRequest, changes.all_files, input.codex_summary ?? combinedText);
    const missingTests = missingTestEvidence(input, changes);
    const mismatch = requirementMismatch(input.requirement_strand, input.codex_summary ?? combinedText, originalRequest);
    const architectureRisks = architectureRisk(input, changes, largeRefactor);
    const securityRisks = securityRisk(hardcodedSecrets, dangerousCommands, forbiddenFilesTouched, combinedText);
    const performanceRisks = performanceRisk(combinedText);
    const requiredFixes = requiredFixList({
        forbiddenFilesTouched,
        unrelatedChanges,
        dangerousCommands,
        hardcodedSecrets,
        largeRefactor,
        missingTests,
        mismatch,
        architectureRisks,
        securityRisks,
        performanceRisks,
        deletedFiles: changes.deleted_files
    });
    const riskLevel = riskLevelFrom({
        forbiddenFilesTouched,
        dangerousCommands,
        hardcodedSecrets,
        largeRefactor,
        missingTests,
        deletedFiles: changes.deleted_files,
        unrelatedChanges
    });
    const finalVerdict = verdictFrom({
        riskLevel,
        forbiddenFilesTouched,
        dangerousCommands,
        hardcodedSecrets,
        requiredFixes,
        deletedFiles: changes.deleted_files
    });
    return {
        changes,
        forbidden_files_touched: forbiddenFilesTouched,
        unrelated_changes: unrelatedChanges,
        dangerous_commands: dangerousCommands,
        hardcoded_secrets: hardcodedSecrets,
        api_keys: apiKeys,
        large_unrequested_refactor: largeRefactor,
        missing_tests: missingTests,
        requirement_mismatch: mismatch,
        architecture_risks: architectureRisks,
        security_risks: securityRisks,
        performance_risks: performanceRisks,
        risk_level: riskLevel,
        required_fixes: requiredFixes,
        final_verdict: finalVerdict
    };
}
export function parseChangeSet(diffText, changedFiles = []) {
    const modified = new Set();
    const added = new Set();
    const deleted = new Set();
    const lines = diffText.split(/\r?\n/);
    let currentFile = "";
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const git = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        if (git) {
            currentFile = normalizePath(git[2]);
            modified.add(currentFile);
            continue;
        }
        const plus = line.match(/^\+\+\+ b\/(.+)$/);
        if (plus) {
            currentFile = normalizePath(plus[1]);
            modified.add(currentFile);
            continue;
        }
        const explicit = line.match(/^\s*(?:modified|changed|created|added|deleted|removed):\s+(.+)$/i);
        if (explicit) {
            const file = normalizePath(explicit[1]);
            modified.add(file);
            if (/created|added/i.test(line)) {
                added.add(file);
            }
            if (/deleted|removed/i.test(line)) {
                deleted.add(file);
            }
        }
        if (/^new file mode /i.test(line) && currentFile) {
            added.add(currentFile);
        }
        if (/^deleted file mode /i.test(line) && currentFile) {
            deleted.add(currentFile);
        }
        const minus = line.match(/^--- a\/(.+)$/);
        const plusDevNull = lines[index + 1]?.match(/^\+\+\+ \/dev\/null/);
        if (minus && plusDevNull) {
            deleted.add(normalizePath(minus[1]));
        }
        const minusDevNull = line.match(/^--- \/dev\/null/);
        const plusFile = lines[index + 1]?.match(/^\+\+\+ b\/(.+)$/);
        if (minusDevNull && plusFile) {
            added.add(normalizePath(plusFile[1]));
        }
    }
    for (const file of changedFiles) {
        const normalized = normalizePath(file);
        if (normalized) {
            modified.add(normalized);
        }
    }
    const modifiedFiles = [...modified].filter((file) => file && file !== "/dev/null").sort();
    const addedFiles = [...added].filter((file) => file && file !== "/dev/null").sort();
    const deletedFiles = [...deleted].filter((file) => file && file !== "/dev/null").sort();
    return {
        modified_files: modifiedFiles,
        added_files: addedFiles,
        deleted_files: deletedFiles,
        all_files: uniqueStrings([...modifiedFiles, ...addedFiles, ...deletedFiles]).sort()
    };
}
export function normalizePath(value) {
    return value.trim().replace(/^["']|["']$/g, "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/[.,;:]$/g, "");
}
export function matchesPathPattern(file, pattern) {
    const normalizedFile = normalizePath(file);
    const normalizedPattern = normalizePath(pattern);
    if (!normalizedFile || !normalizedPattern) {
        return false;
    }
    if (normalizedPattern === "**" || normalizedPattern === "*") {
        return true;
    }
    if (normalizedPattern.endsWith("/")) {
        const prefix = normalizedPattern.replace(/\/$/, "");
        return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
    }
    if (normalizedPattern.includes("*")) {
        const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        return new RegExp(`^${escaped}$`, "i").test(normalizedFile);
    }
    return normalizedFile === normalizedPattern || normalizedFile.endsWith(`/${normalizedPattern}`);
}
export function forbiddenTouched(files, forbiddenPatterns) {
    return files.filter((file) => forbiddenPatterns.some((pattern) => matchesPathPattern(file, pattern)));
}
export function strictAllowedFilesFromText(text) {
    const results = [];
    const patterns = [
        /\bonly\s+(?:modify|edit|change|touch)\s+([A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)/gi,
        /\bonly\s+(?:modify|edit|change|touch)\s+([A-Za-z0-9_./\\-]+\/)/gi,
        /\bdo not modify unrelated files\b/gi
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            if (match[1]) {
                results.push(normalizePath(match[1]));
            }
        }
    }
    return uniqueStrings(results);
}
export function extractPathMentions(text) {
    const matches = text.match(/\b[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+(?:\.[A-Za-z0-9]+)?\/?/g) ?? [];
    return uniqueStrings(matches.map(normalizePath));
}
function unrelatedChangedFiles(files, originalRequest, analysis, guardrails) {
    const requestRequiresScope = /unrelated|only\s+(?:modify|edit|change|touch)|scoped|do not modify/i.test(originalRequest);
    const allowed = uniqueStrings([
        ...(guardrails?.allowed_files ?? []),
        ...(analysis?.affected_files ?? []).filter((item) => !/scan|inspect|before selecting/i.test(item))
    ]);
    if (!requestRequiresScope || allowed.length === 0) {
        return [];
    }
    return files.filter((file) => !allowed.some((pattern) => matchesPathPattern(file, pattern)));
}
function findPatternLabels(text, patterns) {
    const labels = [];
    for (const [pattern, label] of patterns) {
        if (pattern.test(text)) {
            labels.push(label);
        }
    }
    return uniqueStrings(labels);
}
function isLargeUnrequestedRefactor(originalRequest, files, text) {
    const requested = /refactor|restructure|rewrite|reorganize|migration|architecture/i.test(originalRequest);
    if (requested) {
        return false;
    }
    if (files.length >= 8) {
        return true;
    }
    return /broad refactor|large refactor|rewrote|reorganized|restructured|whole app/i.test(text);
}
function missingTestEvidence(input, changes) {
    const text = `${input.diff_text ?? ""}\n${input.codex_summary ?? ""}`;
    const explicitMissing = /(skipped|skip|did not run|not run|no tests|without tests|no verification|did not verify|skipped verification)/i.test(text);
    const hasEvidence = /(npm test|npm run test|pytest|vitest|jest|pnpm test|yarn test|cargo test|go test|verification|verified|passed|manual check|manual test|lint|build)/i.test(text);
    const hasTestFile = changes.all_files.some((file) => /(\.test\.|\.spec\.|__tests__|\/tests?\/)/i.test(file));
    if (!explicitMissing && (hasEvidence || hasTestFile)) {
        return [];
    }
    const required = input.guardrails?.required_tests ?? [];
    if (required.length > 0) {
        return required.map((item) => `Missing required test or verification evidence: ${item}`);
    }
    return ["No test, build, lint, or manual verification evidence was provided."];
}
function requirementMismatch(requirement, text, fallbackRequest) {
    const goal = requirement?.core_goal || fallbackRequest;
    const terms = importantTerms(goal);
    if (terms.length === 0) {
        return [];
    }
    const lowered = text.toLowerCase();
    const hits = terms.filter((term) => lowered.includes(term));
    if (hits.length >= Math.max(1, Math.ceil(terms.length / 3))) {
        return [];
    }
    return [`Output does not mention enough key requirement terms from "${goal}".`];
}
function architectureRisk(input, changes, largeRefactor) {
    const text = `${input.codex_summary ?? ""}\n${input.diff_text ?? ""}`;
    return uniqueStrings([
        largeRefactor ? "Large unrequested refactor detected." : "",
        /(temporary|quick fix|hack|workaround|monolith)/i.test(text) ? "Temporary or brittle implementation language detected." : "",
        changes.deleted_files.length > 0 ? `Deleted files require architecture review: ${changes.deleted_files.join(", ")}` : ""
    ]);
}
function securityRisk(hardcodedSecrets, dangerousCommands, forbiddenFiles, text) {
    return uniqueStrings([
        hardcodedSecrets.length > 0 ? "Hardcoded secret or API key pattern detected." : "",
        dangerousCommands.length > 0 ? "Dangerous command pattern detected." : "",
        forbiddenFiles.some((file) => /^\.env/i.test(file)) ? "Environment file was modified." : "",
        /\bauth\b|\blogin\b|\bpassword\b/i.test(text) && !/(sanitize|validate|hash|session|csrf|permission|authorization)/i.test(text)
            ? "Authentication-related change lacks obvious validation or security notes."
            : ""
    ]);
}
function performanceRisk(text) {
    return uniqueStrings([
        /(o\(n\^2\)|nested loop|memory leak|blocking|timeout|slow query|unbounded)/i.test(text) ? "Potential performance risk mentioned in output." : ""
    ]);
}
function requiredFixList(input) {
    return uniqueStrings([
        input.forbiddenFilesTouched.length ? `Restore or revert forbidden file changes: ${input.forbiddenFilesTouched.join(", ")}` : "",
        input.unrelatedChanges.length ? `Remove unrelated changes: ${input.unrelatedChanges.join(", ")}` : "",
        input.dangerousCommands.length ? `Remove dangerous command usage: ${input.dangerousCommands.join("; ")}` : "",
        input.hardcodedSecrets.length ? "Remove hardcoded secrets and use environment variables or documented configuration instead." : "",
        input.largeRefactor ? "Replace the unrequested broad refactor with a focused change." : "",
        input.deletedFiles.length ? `Restore deleted files unless deletion was explicitly requested: ${input.deletedFiles.join(", ")}` : "",
        ...input.missingTests,
        ...input.mismatch,
        ...input.architectureRisks,
        ...input.securityRisks,
        ...input.performanceRisks
    ]);
}
function riskLevelFrom(input) {
    if (input.dangerousCommands.length || input.hardcodedSecrets.length || input.deletedFiles.length) {
        return "critical";
    }
    if (input.forbiddenFilesTouched.length || input.largeRefactor || input.unrelatedChanges.length > 3) {
        return "high";
    }
    if (input.missingTests.length || input.unrelatedChanges.length) {
        return "medium";
    }
    return "low";
}
function verdictFrom(input) {
    if (input.riskLevel === "critical" || input.dangerousCommands.length || input.hardcodedSecrets.length || input.deletedFiles.length) {
        return "blocked";
    }
    if (input.forbiddenFilesTouched.length) {
        return "needs_fix";
    }
    if (input.requiredFixes.length) {
        return input.riskLevel === "high" ? "needs_fix" : "pass_with_warnings";
    }
    return "pass";
}
function importantTerms(text) {
    const stop = new Set([
        "the",
        "and",
        "with",
        "that",
        "this",
        "for",
        "from",
        "into",
        "code",
        "task",
        "add",
        "make",
        "fix",
        "run",
        "test",
        "tests"
    ]);
    return uniqueStrings((text.toLowerCase().match(/[a-z0-9_-]{4,}/g) ?? []).filter((word) => !stop.has(word)).slice(0, 10));
}
