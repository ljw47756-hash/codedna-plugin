# CodeDNA Post-Task Reminder

After Codex produces a diff, final summary, error log, or test result for a CodeDNA-prepared task, review it before accepting completion.

Recommended sequence:

1. Call `codedna_review_output` with the original Requirement Strand, Analysis Strand, project profile when available, and Codex output.
2. If the verdict is `needs_fix`, use `review_report.next_codex_fix_prompt` as the next repair brief.
3. If the task revealed a stable user preference, successful pattern, or rejected pattern, call `codedna_update_memory`.
4. Report the review artifact path and any required fixes.

This reminder is advisory. It should not claim completion without verification evidence.
