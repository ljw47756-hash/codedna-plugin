export function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim();
}

export function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|(?<=[。！？；])\s*|[;；銆锛紱]\s*|\n+/u)
    .map((part) => part.trim().replace(/^[,，；。！？.!?銆锛紱\s]+|[,，；。！？.!?銆锛紱\s]+$/g, ""))
    .filter(Boolean);
}

export function splitClauses(value: string): string[] {
  const parts = value
    .split(/[,，、；;銆锛紱]|(?:\s+and\s+)|(?:\s+with\s+)|(?:同时|但是|不过|然后|另外|并且|以及|鍚屾椂|浣嗘槸|涓嶈繃|鐒跺悗|鍙﹀|骞朵笖|浠ュ強)/iu)
    .map((part) => part.trim().replace(/^[.。!?！？銆\s]+|[.。!?！？銆\s]+$/g, ""))
    .filter(Boolean);
  return parts.length > 0 ? parts : [value.trim()];
}

export function uniqueStrings(items: Iterable<unknown>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
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

export function containsAny(value: string, hints: Iterable<string>): boolean {
  const lowered = value.toLocaleLowerCase();
  for (const hint of hints) {
    if (lowered.includes(hint.toLocaleLowerCase()) || value.includes(hint)) {
      return true;
    }
  }
  return false;
}

export function tokens(value: string): Set<string> {
  const lowered = value.toLocaleLowerCase();
  const words = lowered.match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
  const cjk = Array.from(lowered).filter((char) => /[\u4e00-\u9fff]/u.test(char));
  return new Set([...words, ...cjk]);
}

export function similarity(left: string, right: string): number {
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

export function bestMatch(source: string, candidates: string[]): { item: string; score: number } {
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

export function arrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return uniqueStrings(value);
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
