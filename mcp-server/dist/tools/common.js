export function normalizeText(value) {
    return String(value ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim();
}
export function splitSentences(value) {
    return value
        .split(/(?<=[.!?;])\s+|[;]\s*|\n+/u)
        .map((part) => part.trim().replace(/^[,.\s]+|[,.\s]+$/g, ""))
        .filter(Boolean);
}
export function splitClauses(value) {
    const parts = value
        .split(/[,]|(?:\s+and\s+)|(?:\s+with\s+)/iu)
        .map((part) => part.trim().replace(/^[.\s]+|[.\s]+$/g, ""))
        .filter(Boolean);
    return parts.length > 0 ? parts : [value.trim()];
}
export function uniqueStrings(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const value = String(item ?? "").trim();
        const key = value.toLocaleLowerCase();
        if (value && !seen.has(key)) {
            result.push(value);
            seen.add(key);
        }
    }
    return result;
}
export function containsAny(value, hints) {
    const lowered = value.toLocaleLowerCase();
    for (const hint of hints) {
        if (lowered.includes(hint.toLocaleLowerCase()) || value.includes(hint)) {
            return true;
        }
    }
    return false;
}
export function tokens(value) {
    const lowered = value.toLocaleLowerCase();
    const words = lowered.match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
    const cjk = Array.from(lowered).filter((char) => /[\u4e00-\u9fff]/u.test(char));
    return new Set([...words, ...cjk]);
}
export function similarity(left, right) {
    const leftTokens = tokens(left);
    const rightTokens = tokens(right);
    if (leftTokens.size === 0 || rightTokens.size === 0) {
        return 0;
    }
    let overlap = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            overlap += 1;
        }
    }
    return overlap / Math.max(leftTokens.size, rightTokens.size);
}
export function bestMatch(source, candidates) {
    let item = "";
    let score = 0;
    for (const candidate of candidates) {
        const current = similarity(source, candidate);
        if (current > score) {
            item = candidate;
            score = current;
        }
    }
    return { item, score };
}
export function arrayFromUnknown(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return uniqueStrings(value);
}
export function jsonClone(value) {
    return JSON.parse(JSON.stringify(value));
}
