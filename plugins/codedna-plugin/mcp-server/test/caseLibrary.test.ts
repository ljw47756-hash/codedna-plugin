import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const libraryDir = path.join(rootDir, "case-library");

const expectedPublicCounts: Record<string, number> = {
  "swe-bench-verified": 100,
  "codex-github": 100,
  "mcp-failures": 50,
  "agent-failures": 50,
  "ai-coding-pr-outcomes": 50,
  "rag-knowledge-failures": 50,
  "security-incidents": 30,
  "successful-architectures": 50
};

test("case library contains retained CodeDNA effects and public-safe source metadata", async () => {
  const sources = JSON.parse(await readFile(path.join(libraryDir, "sources.json"), "utf8")) as {
    sources: Array<{ name: string; url: string; license: string; usage: string }>;
  };
  const sourceNames = new Set(sources.sources.map((source) => source.name));
  for (const required of [
    "SWE-bench/SWE-bench",
    "mem0ai/mem0",
    "Gentleman-Programming/engram",
    "DeusData/codebase-memory-mcp",
    "alioshr/memory-bank-mcp",
    "shaneholloman/mcp-knowledge-graph",
    "volcengine/OpenViking"
  ]) {
    assert.ok(sourceNames.has(required), `sources.json should include ${required}`);
  }

  const effectLines = (await readFile(path.join(libraryDir, "effects", "codedna-retained-effects.jsonl"), "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(effectLines.length, 651);
  assert.equal(effectLines.filter((item) => item.fit === "strong").length, 402);
  assert.equal(effectLines.filter((item) => item.fit === "medium").length, 249);

  const caseFiles = (await readdir(path.join(libraryDir, "cases"))).filter((name) => name.endsWith(".jsonl"));
  const cases = [];
  for (const file of caseFiles) {
    const content = await readFile(path.join(libraryDir, "cases", file), "utf8");
    for (const line of content.split(/\r?\n/u).filter(Boolean)) {
      cases.push(JSON.parse(line));
    }
  }

  assert.equal(cases.length, 1782);
  for (const [category, expected] of Object.entries(expectedPublicCounts)) {
    assert.equal(
      cases.filter((item) => item.category === category).length,
      expected,
      `${category} should contain ${expected} cases`
    );
  }
  assert.equal(cases.filter((item) => item.category === "retained-success").length, 651);
  assert.equal(cases.filter((item) => item.category === "retained-failure").length, 651);

  const ids = new Set<string>();
  for (const item of [...effectLines, ...cases]) {
    assert.equal(item.public_safe, true);
    assert.equal(typeof item.id, "string");
    assert.ok(!ids.has(item.id), `duplicate case id: ${item.id}`);
    ids.add(item.id);
    if (item.category !== "retained-effect" && !String(item.category).startsWith("retained-")) {
      assert.equal(typeof item.source_url, "string");
      assert.match(item.source_url, /^https:\/\/(github\.com|huggingface\.co|osv\.dev)\//u);
    }
    assert.equal(typeof item.license, "string");
    assert.equal(typeof item.summary, "string");
    assert.ok(item.summary.length > 20 && item.summary.length <= 240);
    assert.equal(typeof item.codedna_pattern, "string");
    assert.ok(item.codedna_pattern.length > 10 && item.codedna_pattern.length <= 200);
    assert.equal(typeof item.guardrail, "string");
    assert.ok(item.guardrail.length > 10 && item.guardrail.length <= 240);
    assert.ok(Array.isArray(item.tags));
    assert.ok(item.tags.length >= 2);
    assert.equal("raw_body" in item, false);
    assert.equal("diff" in item, false);
    assert.equal("code" in item, false);
    assert.equal("source_path" in item, false);
    assert.equal("private_source_path" in item, false);
    assert.equal(/commands\\|components\\|services\\|tools\\/u.test(JSON.stringify(item)), false);
    assert.equal(/```/u.test(JSON.stringify(item)), false);
  }
});
