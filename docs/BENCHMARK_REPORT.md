# CodeDNA Self-Benchmark Evolution

Benchmark name: CodeDNA Self-Benchmark Evolution Loop
Test time: 2026-06-16T02:02:22.855Z
Rounds: 1
Cases per round: 100
Threshold: 95%
Final accuracy: 95%
Qualified: yes
Release allowed: yes

## Round Accuracy

- benchmark-round-1: 95% (95/100)

## Final Accuracy By Level

- blocked: 100%
- cautious: 85.71%
- full: 100%
- edge: 100%

## Failure Summary

- Failed cases: 5
- Major failure patterns: `cautious: Pairing score calibration does not match the expected DNA gate level.`

## Repair Summary

- benchmark-round-1
  - Adjust pairing score calculation and execution-level caps without hardcoding individual cases.

## Public Data Policy

This report is sanitized for the public repository. Full benchmark run records, failed-case details, successful-pattern summaries, and repair records are stored locally under `data/memory/evolution/` and are intentionally excluded from GitHub.

