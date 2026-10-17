# Question generation

Makes a day's set of questions for one user, aimed at their gaps. Claude runs this from the
project chat when asked ("new questions"). The portal shows the set on Today and keeps it in History.

## 1. Read history

```sql
-- Profile and goal
select user_id, level, minutes_per_day, ready_by from profiles;

-- Per-topic progress (view in supabase/schema.sql): asked, answered, graded, avg, last score,
-- last asked, Bayesian mastery, focus weight
select * from topic_progress where user_id = $1 order by focus_weight desc;

-- Everything asked in the last 30 days, so no scenario repeats
select set_date, topic_id, left(prompt, 160) from questions
where user_id = $1 and set_date >= current_date - 30 order by set_date;

-- For each candidate topic: the last grade's missed or partial points and improvements
select distinct on (h.topic_id) h.topic_id, h.set_date, g.score,
       (select jsonb_agg(r) from jsonb_array_elements(g.rubric_scores) r where r->>'verdict' <> 'met') as gaps,
       g.improvements
from question_history h join grades g on g.answer_id = h.answer_id
where h.user_id = $1 and h.score is not null
order by h.topic_id, h.graded_at desc;
```

## 2. Score every topic

- `mastery = (sum_scores + 2.5 * 2) / (n_graded + 2) / 5`. This is a Bayesian average with a
  prior of 2.5/5 worth two answers, so one 5/5 doesn't mark a topic as mastered. An untried topic
  sits at 0.5.
- `need = 1 - mastery`.
- `recency`: 0.3 if the topic was asked today or yesterday, 0.7 if two or three days ago, otherwise 1.
  A topic with an unanswered question from the last two days also gets 0.3. Unanswered questions
  are never counted as failures.
- `priority = focus_weight * (0.5 + need) * recency`.

This query prints the table, so the owner can see why each topic was picked:

```sql
select topic, round(focus_weight::numeric, 3) as weight, times_graded, last_score, mastery,
       round(1 - mastery, 2) as need, last_asked,
       case when last_asked >= current_date - 1 then 0.3
            when last_asked >= current_date - 3 then 0.7 else 1 end as recency,
       round((focus_weight * (0.5 + 1 - mastery) *
             case when last_asked >= current_date - 1 then 0.3
                  when last_asked >= current_date - 3 then 0.7 else 1 end)::numeric, 3) as priority
from topic_progress where user_id = $1
order by priority desc;
```

Worked example from the real Oct 16 grades, run on Oct 17:

| Topic | Focus weight | Graded | Mastery | Need | Recency | Priority | Next difficulty |
|---|---|---|---|---|---|---|---|
| Monitoring and drift | 0.043 | 0.5 | 0.37 | 0.63 | 0.3 | 0.015 | 2 |
| Past projects deep dive | 0.083 | 2 | 0.47 | 0.53 | 0.3 | 0.026 | 2 |
| Data manipulation | 0.025 | 5 | 0.67 | 0.33 | 0.3 | 0.006 | 3 |
| Model serving and latency | 0.052 | none | 0.50 | 0.50 | 1 | 0.052 | 3 |

Check: Monitoring is (0.5 + 5) / 3 / 5 = 0.367, and 0.043 × (0.5 + 0.633) × 0.3 = 0.015.

## 3. Build the set

1. **Due reviews first** (spaced repetition, Anki-style). Go through a topic's grades in order.
   A grade under 3 makes it due 1 day after that question's `set_date`. Each later grade of 3 or
   more pushes the next review out to 3, then 7 days. A third pass clears it, and any grade under
   3 starts over. Topics due on or before today go in first, at most 2 per day. The portal shows
   them with a **Review** badge (same rule, `app/src/lib/progress.ts`).
2. **Then sample by priority**, weighted, without replacement, until the minutes reach
   `profiles.minutes_per_day`:

       order by -ln(random()) / priority   -- weighted sampling (Efraimidis-Spirakis)

   Keep at least one question from the top-3 focus topics each day.
3. **Difficulty per topic**: start at 3 (Senior). If the last two grades on the topic average
   4 or more, go up 1. If the last grade was 2 or less, go down 1. Keep it between 1 and 5.
4. **Format** comes from the topic category: coding → coding, ml_coding → ml_coding,
   ml_fundamentals / deep_learning → ml_concept, ml_system_design → ml_system_design,
   system_design → system_design, behavioral → behavioral.

## 4. Write each question

One Claude call per question, no tools. Inputs:
- the topic, with the matching `round_topics.detail` and `research_profiles.style_notes`;
- the user's level, and the resume for behavioral and project questions;
- the difficulty;
- the missed and partial rubric points and `improvements` from the topic's last grade;
- the prompts from the last 30 days.

The new question tests exactly those gaps, from a new scenario. Don't re-ask the same scenario.

Output: `prompt`, `rubric` (4-6 checkable points a strong answer covers), `minutes`, and a
`reason`.

`prompt` is Markdown (the portal renders it). Coding and SQL questions are LeetCode-style:
- a short problem statement saying exactly what to return;
- `### Tables` (or the function signature): one Markdown table of columns and types per input;
- `### Example`: sample input rows as tables, then **Expected output** as a table;
- `### Explanation`: one bullet per output row saying why it comes out that way, covering the
  edge cases the rubric checks (e.g. a row with no events still counted);
- the dialect or language, and any convention (e.g. weeks start Monday).

Check the expected output by running the reference solution on the example rows before inserting.
A read-only `with ... as (values ...)` query works for SQL.

`reason` is one or two sentences the owner sees as "Why this question". It names the gap, for
example: "Monitoring and drift: you scored 0.5/5 on Oct 16 and missed drift detection and alerting,
so this one is narrower, at difficulty 2." Start review questions with "Review:".

## 5. Insert

Insert into `questions` with `set_date` set to the owner's **local** date. It defaults to the
server's UTC date, which is already tomorrow on a US evening. Grading scores answers against
`rubric` (agents/grading/README.md).
