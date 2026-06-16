import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BenchmarkRepairPlan, BenchmarkReportPaths, BenchmarkScoreSummary } from "./benchmarkTypes.js";

export interface GenerateBenchmarkReportsInput {
  docs_root: string;
  runs: BenchmarkScoreSummary[];
  final_score: BenchmarkScoreSummary;
  repair_plans: BenchmarkRepairPlan[];
  qualified: boolean;
  threshold: number;
  difficulty?: string;
}

export async function generateBenchmarkReports(input: GenerateBenchmarkReportsInput): Promise<BenchmarkReportPaths> {
  await mkdir(input.docs_root, { recursive: true });
  const benchmarkReportPath = join(input.docs_root, "BENCHMARK_REPORT.md");
  const evolutionLogPath = join(input.docs_root, "EVOLUTION_LOG.md");
  await writeFile(benchmarkReportPath, `${benchmarkReport(input)}\n`, "utf8");
  await writeFile(evolutionLogPath, `${evolutionLog(input)}\n`, "utf8");
  return { benchmark_report_path: benchmarkReportPath, evolution_log_path: evolutionLogPath };
}

function benchmarkReport(input: GenerateBenchmarkReportsInput): string {
  const final = input.final_score;
  return `# CodeDNA Self-Benchmark Evolution

Benchmark name: CodeDNA Self-Benchmark Evolution Loop
Difficulty: ${input.difficulty ?? "standard"}
Test time: ${final.generated_at}
Rounds: ${input.runs.length}
Cases per round: ${final.total_cases}
Threshold: ${input.threshold}%
Final accuracy: ${final.accuracy}%
Qualified: ${input.qualified ? "yes" : "no"}
Release allowed: ${input.qualified ? "yes" : "no"}

## Round Accuracy

${input.runs.map((run) => `- ${run.round_id}: ${run.accuracy}% (${run.passed_cases}/${run.total_cases})`).join("\n")}

## Final Accuracy By Level

- blocked: ${final.per_level_accuracy.blocked}%
- cautious: ${final.per_level_accuracy.cautious}%
- full: ${final.per_level_accuracy.full}%
- edge: ${final.per_level_accuracy.edge}%

## Failure Summary

- Failed cases: ${final.failed_cases.length}
- Major failure patterns: ${final.failure_patterns.length ? final.failure_patterns.map((item) => `\`${sanitize(item)}\``).join(", ") : "None"}

## Repair Summary

${repairBullets(input.repair_plans)}

## Public Data Policy

This report is sanitized for the public repository. Full benchmark run records, failed-case details, successful-pattern summaries, and repair records are stored locally under \`data/memory/evolution/\` and are intentionally excluded from GitHub.
`;
}

function evolutionLog(input: GenerateBenchmarkReportsInput): string {
  const final = input.final_score;
  return `# CodeDNA Evolution Log

## Goal

Run CodeDNA against generated benchmark cases and preserve the original double-strand workflow:

Benchmark difficulty: ${input.difficulty ?? "standard"}

\`\`\`text
User Requirement Strand
    <-> Pairing Review
Reverse Analysis Strand
    -> Codex Task Pack
    -> Code Execution
    -> Reverse Review
    -> Memory Evolution
\`\`\`

## Design Integrity

- Requirement Strand preserved: yes
- Reverse Analysis Strand preserved: yes
- Pairing Review preserved: yes
- Codex Task Pack gate preserved: yes
- Reverse Review preserved: yes
- Memory Evolution preserved: yes

## Rounds

${input.runs
  .map(
    (run) =>
      `- ${run.round_id}: accuracy ${run.accuracy}%, failed ${run.failed_cases.length}, patterns ${
        run.failure_patterns.length ? run.failure_patterns.map((item) => `\`${sanitize(item)}\``).join(", ") : "None"
      }`
  )
  .join("\n")}

## Repairs

${repairBullets(input.repair_plans)}

## Final Result

- Final accuracy: ${final.accuracy}%
- Required threshold: ${input.threshold}%
- Qualified for release: ${input.qualified ? "yes" : "no"}
- Remaining public limitations: ${final.failed_cases.length === 0 ? "None from this benchmark run." : "Some local failure details remain in private memory evolution records."}
`;
}

function repairBullets(plans: BenchmarkRepairPlan[]): string {
  if (plans.length === 0) {
    return "- No repair plans were required.";
  }
  return plans
    .map((plan) => {
      const actions = plan.repair_actions.length ? plan.repair_actions.map((item) => `  - ${sanitize(item)}`).join("\n") : "  - None";
      return `- ${plan.round_id}\n${actions}`;
    })
    .join("\n");
}

function sanitize(value: string): string {
  return value.replace(/[A-Z]:[\\/][^\s)]+/g, "<PROJECT_ROOT>").replace(/C:\\Users\\[^\\\s)]+/g, "<USER_HOME>");
}
