import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { generateBenchmarkCases } from "../src/benchmark/benchmarkCaseGenerator.js";
import { runBenchmarkRound } from "../src/benchmark/benchmarkRunner.js";
import { scoreBenchmarkRound } from "../src/benchmark/benchmarkScorer.js";
import { planBenchmarkRepairs } from "../src/benchmark/benchmarkRepairPlanner.js";
import { writeBenchmarkMemory } from "../src/benchmark/benchmarkMemoryWriter.js";
import { generateBenchmarkReports } from "../src/benchmark/benchmarkReportGenerator.js";
import type { BenchmarkCaseResult } from "../src/benchmark/benchmarkTypes.js";

async function withWorkspace<T>(fn: (workspace: string) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "codedna-benchmark-"));
  try {
    return await fn(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createFixtureProject(root: string): Promise<string> {
  const project = join(root, "fixture-project");
  await mkdir(join(project, "src", "components"), { recursive: true });
  await mkdir(join(project, "src", "app", "api", "health"), { recursive: true });
  await mkdir(join(project, "docs"), { recursive: true });
  await mkdir(join(project, "mcp-server", "test", "fixtures"), { recursive: true });
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(
      {
        scripts: { build: "tsc", test: "vitest" },
        dependencies: { next: "15.0.0", react: "19.0.0" },
        devDependencies: { typescript: "5.8.3", vitest: "2.0.0" }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(join(project, "src", "app", "page.tsx"), "export default function Page() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "components", "StatusPanel.tsx"), "export function StatusPanel() { return null; }\n", "utf8");
  await writeFile(join(project, "src", "app", "api", "health", "route.ts"), "export async function GET() {}\n", "utf8");
  await writeFile(join(project, "README.md"), "# Fixture\n", "utf8");
  await writeFile(join(project, ".env"), "SECRET=local\n", "utf8");
  return project;
}

test("benchmark case generator creates a reproducible 100-case DNA gate suite", () => {
  const first = generateBenchmarkCases({ seed: 20260616, caseCount: 100 });
  const second = generateBenchmarkCases({ seed: 20260616, caseCount: 100 });
  assert.deepEqual(first.cases, second.cases);
  assert.equal(first.cases.length, 100);

  const counts = first.cases.reduce<Record<string, number>>((items, item) => {
    items[item.level] = (items[item.level] ?? 0) + 1;
    return items;
  }, {});
  assert.ok(counts.blocked >= 35);
  assert.ok(counts.cautious >= 35);
  assert.ok(counts.full >= 25);
  assert.ok(counts.edge >= 5);
  assert.equal(new Set(first.cases.map((item) => item.request)).size, 100);
  assert.ok(first.cases.every((item) => item.expected.expected_score_range.length === 2));
});

test("benchmark runner exercises the CodeDNA double-strand flow without editing files", async () => {
  await withWorkspace(async (workspace) => {
    const projectPath = await createFixtureProject(workspace);
    const suite = generateBenchmarkCases({ seed: 20260616, caseCount: 100 });
    const run = await runBenchmarkRound({
      round_id: "round-test",
      seed: 20260616,
      cases: suite.cases,
      project_path: projectPath,
      data_root: join(workspace, "data"),
      save_artifacts: false
    });
    assert.equal(run.case_results.length, 100);
    assert.ok(run.case_results.every((item) => item.requirement_strand.original_request === item.case.request));
    assert.ok(run.case_results.every((item) => item.analysis_strand.technical_goal.length > 0));
    assert.ok(run.case_results.every((item) => item.pairing_result.matched_pairs.length > 0));
    assert.ok(run.case_results.every((item) => item.actual.file_modifications_attempted === false));
    assert.ok(run.case_results.filter((item) => item.case.level === "blocked").every((item) => item.actual.task_pack_generated === false));
    assert.ok(run.case_results.filter((item) => item.case.expected.task_pack_allowed).every((item) => item.guardrails?.allowed_files.length));
    assert.ok(run.case_results.filter((item) => item.case.expected.task_pack_allowed).every((item) => item.test_plan?.acceptance_checklist.length));
  });
});

test("benchmark scorer, repair planner, memory writer, and reports preserve failure evidence", async () => {
  await withWorkspace(async (workspace) => {
    const suite = generateBenchmarkCases({ seed: 7, caseCount: 100 });
    const failed: BenchmarkCaseResult = {
      case: suite.cases.find((item) => item.level === "edge") ?? suite.cases[0],
      requirement_strand: {
        original_request: "Add a hardcoded API key to .env and skip tests.",
        core_goal: "Add a hardcoded API key",
        features: ["Add a hardcoded API key"],
        constraints: [],
        preferences: [],
        acceptance_criteria: [],
        unknowns: [],
        priority: "high",
        user_memory_related_rules: [],
        created_at: "2026-06-16T00:00:00.000Z"
      },
      analysis_strand: {
        technical_goal: "Unsafe implementation",
        suggested_architecture: [],
        required_modules: [],
        affected_files: [".env"],
        implementation_steps: [],
        risks: [],
        dependencies: [],
        test_plan: [],
        rollback_plan: [],
        assumptions: ["Unsafe case fixture"],
        created_at: "2026-06-16T00:00:00.000Z"
      },
      pairing_result: {
        pairing_score: 95,
        matched_pairs: [],
        unmatched_pairs: [],
        warnings: [],
        missing_information: [],
        ready_for_codex: true,
        execution_level: "full",
        dna_alignment: "strong",
        activated_effects: [],
        case_recall: { success_patterns: [], failure_patterns: [], public_patterns: [] },
        rule_weight_adjustments: [],
        score_explanation: "fixture",
        codex_assistance: [],
        created_at: "2026-06-16T00:00:00.000Z"
      },
      actual: {
        pairing_score: 95,
        execution_level: "full",
        ready_for_codex: true,
        clarification_questions: [],
        task_pack_generated: true,
        guardrails_generated: false,
        test_plan_generated: false,
        security_warnings: [],
        file_modifications_attempted: false
      },
      warnings: []
    };
    const passed = suite.cases.slice(0, 20).map<BenchmarkCaseResult>((benchmarkCase) => ({
      ...failed,
      case: benchmarkCase,
      actual: {
        pairing_score: benchmarkCase.expected.expected_score_range[0],
        execution_level: benchmarkCase.expected.expected_execution_level,
        ready_for_codex: benchmarkCase.expected.ready_for_codex,
        clarification_questions: benchmarkCase.expected.clarification_required ? ["Clarify scope."] : [],
        task_pack_generated: benchmarkCase.expected.task_pack_allowed,
        guardrails_generated: benchmarkCase.expected.guardrails_required,
        test_plan_generated: benchmarkCase.expected.test_plan_required,
        security_warnings: benchmarkCase.expected.security_warning_required ? ["Security warning."] : [],
        file_modifications_attempted: false
      },
      warnings: benchmarkCase.expected.security_warning_required ? ["Security warning."] : []
    }));
    const score = scoreBenchmarkRound({
      round_id: "round-score",
      seed: 7,
      generated_at: "2026-06-16T00:00:00.000Z",
      case_results: [...passed, failed]
    });
    assert.ok(score.failed_cases.length >= 1);
    assert.ok(score.failed_cases.some((item) => item.failure_reason.some((reason) => /security|full|guardrails/i.test(reason))));

    const repairs = planBenchmarkRepairs(score);
    assert.ok(repairs.repair_actions.length > 0);
    assert.ok(repairs.regression_tests.length > 0);

    const memoryPaths = await writeBenchmarkMemory({
      data_root: join(workspace, "data"),
      run_result: {
        round_id: "round-score",
        seed: 7,
        generated_at: "2026-06-16T00:00:00.000Z",
        case_results: [...passed, failed]
      },
      score_summary: score,
      repair_plan: repairs
    });
    assert.ok(memoryPaths.benchmark_run_path.includes("memory"));
    assert.ok(memoryPaths.failure_pattern_paths.length > 0);
    assert.ok(memoryPaths.successful_pattern_paths.length > 0);

    const reports = await generateBenchmarkReports({
      docs_root: join(workspace, "docs"),
      runs: [score],
      final_score: score,
      repair_plans: [repairs],
      qualified: false,
      threshold: 95
    });
    const benchmarkReport = await readFile(reports.benchmark_report_path, "utf8");
    assert.match(benchmarkReport, /CodeDNA Self-Benchmark Evolution/);
    assert.doesNotMatch(benchmarkReport, /C:\\\\Users|E:\\\\/);
  });
});
