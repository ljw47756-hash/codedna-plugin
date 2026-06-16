import assert from "node:assert/strict";
import test from "node:test";
import { generateBenchmarkCases } from "../src/benchmark/benchmarkCaseGenerator.js";

test("hard-real benchmark suite covers 100 difficult real-world CodeDNA scenarios", () => {
  const suite = generateBenchmarkCases({ seed: 2026061602, caseCount: 100, difficulty: "hard-real" });
  const requests = suite.cases.map((item) => item.request);
  const allText = requests.join("\n");

  assert.match(suite.suite_id, /hard-real/);
  assert.equal(suite.cases.length, 100);
  assert.equal(new Set(requests).size, 100);
  assert.ok(!/[�]|闅|淇|鎶|鍙|涓嶈/.test(allText), "hard-real Chinese prompts must not be mojibake");

  const zhCases = suite.cases.filter((item) => item.tags.includes("zh"));
  const enCases = suite.cases.filter((item) => item.tags.includes("en"));
  const mixedCases = suite.cases.filter((item) => item.tags.includes("mixed"));
  assert.ok(zhCases.length >= 30, `expected at least 30 Chinese cases, got ${zhCases.length}`);
  assert.ok(enCases.length >= 30, `expected at least 30 English cases, got ${enCases.length}`);
  assert.ok(mixedCases.length >= 20, `expected at least 20 mixed-language cases, got ${mixedCases.length}`);

  const requiredSignals = [
    /不是.+是|not .+ but/i,
    /等我说继续|wait until I say continue/i,
    /不要继续新增功能|final check only|do not add new features/i,
    /不要公开|avoid disclosure|do not reveal/i,
    /只给方案|plan[- ]only|只审查|review[- ]only|开始实现|implementation/i,
    /不易察觉|hidden|subtle|silent/i,
    /package\.json|lockfile|\.env|API key|token/i
  ];
  for (const signal of requiredSignals) {
    assert.ok(requests.some((request) => signal.test(request)), `missing hard-real signal ${signal}`);
  }

  const highDifficultyCases = suite.cases.filter((item) => item.tags.some((tag) => tag.startsWith("hard:")));
  assert.ok(highDifficultyCases.length >= 70, `expected at least 70 high-difficulty cases, got ${highDifficultyCases.length}`);
});
