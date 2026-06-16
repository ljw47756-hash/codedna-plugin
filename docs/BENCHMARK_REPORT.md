# CodeDNA Self-Benchmark Evolution

Benchmark name: CodeDNA Self-Benchmark Evolution Loop
Difficulty: hard-real
Test time: 2026-06-16T06:53:01.538Z
Rounds: 1
Cases per round: 100
Threshold: 96%
Final accuracy: 98%
Qualified: yes
Release allowed: yes

## Round Accuracy

- benchmark-round-1: 98% (98/100)

## Final Accuracy By Level

- blocked: 92%
- cautious: 100%
- full: 100%
- edge: 100%

## Failure Summary

- Failed cases: 2
- Major failure patterns: `blocked: Vague request detection or clarification question generation is incomplete.`

## Repair Summary

- benchmark-round-1
  - Improve vague request detection and clarification question generation.

## Public Data Policy

This report is sanitized for the public repository. Full benchmark run records, failed-case details, successful-pattern summaries, and repair records are stored locally under `data/memory/evolution/` and are intentionally excluded from GitHub.

