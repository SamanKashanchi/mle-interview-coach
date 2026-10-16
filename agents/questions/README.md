# Question generation

Makes a day's batch of questions for one user.

1. Sample topics from `focus_topics`, weighted, without replacement, until the minutes add up
   to `profiles.minutes_per_day`:

       select topic_id from focus_topics where user_id = $1
       order by -ln(random()) / weight   -- weighted sampling (Efraimidis-Spirakis)

2. Format comes from the topic category: coding -> coding, ml_coding -> ml_coding,
   ml_fundamentals / deep_learning -> ml_concept, ml_system_design -> ml_system_design,
   system_design -> system_design, behavioral -> behavioral.

3. One Claude call per question, no tools. Inputs: the topic, the matching `round_topics.detail`
   and `research_profiles.style_notes` for the user's target companies, the user's level, the
   resume (for behavioral and project questions), difficulty (starts at 3 of 5 for Senior), and
   the user's recent question prompts so nothing repeats. Output: `prompt`, `rubric` (4-6
   checkable points a strong answer covers), `minutes`.

4. Insert into `questions`. Grading (later) scores answers against `rubric`.

For now Claude runs this from the project thread on request.
