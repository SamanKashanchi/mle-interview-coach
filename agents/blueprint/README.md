# Blueprint: per-user topic weights

Output: one `focus_topics` row per user per topic (all 42 topics).

    weight = max(research_score, 0.1) * posting_factor * resume_factor, normalized to sum to 1

- `research_score`: SQL. Sum of `round_topics.weight * profile_rounds.count` (count null = 1)
  over the research profiles matching the user's targets. Topics the research never mentions
  get a floor of 0.1 so they still come up occasionally.
- `posting_factor`, `resume_factor` (0.5 to 1.5): one Claude call with no tools reads the
  user's pasted postings and resume. Raise topics the posting names. Lower topics the resume
  shows the user already does a lot, and raise ones the target needs but the resume shows no
  experience in. Each factor comes with a short reason.
- `reason`: which research rounds and which posting/resume signals produced the weight.

Recompute when targets, postings, the resume or research change. The Mac mini worker
(`worker/prompts/research.md`) recomputes it after researching a new target, keeping the current
resume factors since it can't read the resume file. Claude can also run it from the project chat.
