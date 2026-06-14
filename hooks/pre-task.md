# CodeDNA Pre-Task Reminder

Before starting a complex coding task, use CodeDNA when the request involves multiple files, architecture changes, bug repair, a new feature module, explicit constraints, acceptance criteria, or user preferences.

Recommended sequence:

1. Call `codedna_load_memory`.
2. Call `codedna_scan_project` when a project path is known.
3. Call `codedna_parse_requirement`.
4. Call `codedna_reverse_analyze`.
5. Call `codedna_pair_strands`.
6. If `pairing_score < 70`, ask for missing information before editing.
7. If `pairing_score >= 70`, call `codedna_generate_task_pack` and use the Markdown as the implementation brief.

This reminder is advisory. It should not block tiny factual questions or simple one-command user requests.
