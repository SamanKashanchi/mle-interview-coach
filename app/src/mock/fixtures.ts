// Fixture data for VITE_MOCK=1, shaped exactly like the database rows. The Whatnot
// research, focus plan and questions are copies of real pipeline output; Databricks is a
// second target that has not been researched yet.

import type {
  Answer,
  Company,
  Grade,
  FocusTopic,
  Profile,
  ProfileRound,
  ProfileSource,
  Question,
  ResearchProfile,
  Role,
  RoundTopic,
  Target,
  Topic,
} from '../lib/types'

export const MOCK_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'sam@example.com' }
const U = MOCK_USER.id

export const companies: Company[] = [
  { id: 'c-whatnot', name: 'Whatnot' },
  { id: 'c-databricks', name: 'Databricks' },
  { id: 'c-meta', name: 'Meta' },
]

export const roles: Role[] = [
  { id: 'r-mle-growth', name: 'Machine Learning Engineer, Growth' },
  { id: 'r-mle', name: 'Machine Learning Engineer' },
]

export const profile: Profile = {
  user_id: U,
  name: 'Sam',
  level: 'Senior',
  ready_by: isoDaysFromNow(212),
  minutes_per_day: 60,
  resume_path: `${U}/resume.pdf`,
  resume_name: 'Sam Resume 2026.pdf',
  updated_at: '2026-10-16T20:00:00Z',
}

export const targets: Target[] = [
  {
    id: 't-whatnot',
    user_id: U,
    company_id: 'c-whatnot',
    role_id: 'r-mle-growth',
    job_description:
      'Whatnot is the largest live shopping platform in North America. As an ML Engineer on Buyer Growth you will build ranking, personalization and notification models that bring new buyers into the right shows, own the full ML lifecycle from data pipelines to online experimentation, and partner with product and data science on uplift modeling. Requirements: 4+ years shipping ML to production, strong Python and SQL, experience with XGBoost or deep learning for ranking.',
    created_at: '2026-10-16T19:00:00Z',
  },
  {
    id: 't-databricks',
    user_id: U,
    company_id: 'c-databricks',
    role_id: 'r-mle',
    job_description: null,
    created_at: '2026-10-16T19:01:00Z',
  },
]

const T: [number, string, Topic['category'], string | null][] = [
  [1, 'Arrays and hashing', 'coding', 'Arrays, strings, hash maps and sets'],
  [2, 'Two pointers and sliding window', 'coding', null],
  [3, 'Stacks and queues', 'coding', null],
  [4, 'Binary search', 'coding', null],
  [5, 'Linked lists', 'coding', null],
  [6, 'Trees', 'coding', 'Binary trees, BSTs, traversals'],
  [7, 'Graphs', 'coding', 'BFS, DFS, topological sort, shortest paths'],
  [8, 'Heaps and priority queues', 'coding', null],
  [9, 'Dynamic programming', 'coding', null],
  [10, 'Recursion and backtracking', 'coding', null],
  [11, 'Intervals and sorting', 'coding', null],
  [12, 'Implement ML algorithms from scratch', 'ml_coding', 'k-means, logistic regression, decision tree, kNN in numpy'],
  [13, 'Implement neural network components', 'ml_coding', 'Attention, layers, backprop, loss functions'],
  [14, 'Data manipulation', 'ml_coding', 'pandas / SQL style data wrangling'],
  [15, 'Probability and statistics', 'ml_fundamentals', null],
  [16, 'Linear models and regularization', 'ml_fundamentals', null],
  [17, 'Tree-based models', 'ml_fundamentals', 'Decision trees, random forests, gradient boosting'],
  [18, 'Bias-variance and overfitting', 'ml_fundamentals', null],
  [19, 'Model evaluation and metrics', 'ml_fundamentals', 'Offline vs online metrics, precision/recall, AUC, calibration'],
  [20, 'Feature engineering', 'ml_fundamentals', null],
  [21, 'Optimization', 'ml_fundamentals', 'Gradient descent variants, learning rates, convergence'],
  [22, 'Unsupervised learning', 'ml_fundamentals', 'Clustering, dimensionality reduction'],
  [23, 'Experimentation and A/B testing', 'ml_fundamentals', null],
  [24, 'Neural network fundamentals', 'deep_learning', 'Backprop, activations, initialization, normalization'],
  [25, 'CNNs and computer vision', 'deep_learning', null],
  [26, 'Sequence models and transformers', 'deep_learning', 'RNNs, attention, transformers'],
  [27, 'LLMs', 'deep_learning', 'Pretraining, fine-tuning, RLHF, RAG, prompting, evaluation'],
  [28, 'Embeddings and representation learning', 'deep_learning', null],
  [29, 'Training at scale', 'deep_learning', 'Distributed training, mixed precision, GPU efficiency'],
  [30, 'Recommender systems', 'ml_system_design', 'Candidate generation, ranking, feeds'],
  [31, 'Search and retrieval', 'ml_system_design', 'Retrieval, ranking, ANN indexes'],
  [32, 'Ads and click prediction', 'ml_system_design', null],
  [33, 'Fraud and anomaly detection', 'ml_system_design', null],
  [34, 'Feature pipelines', 'ml_system_design', 'Feature stores, real-time vs batch features'],
  [35, 'Data and labeling pipelines', 'ml_system_design', null],
  [36, 'Model serving and latency', 'ml_system_design', 'Online inference, caching, model compression'],
  [37, 'Monitoring and drift', 'ml_system_design', null],
  [38, 'Distributed systems basics', 'system_design', 'Scaling, caching, queues, consistency'],
  [39, 'API and service design', 'system_design', null],
  [40, 'Past projects deep dive', 'behavioral', 'Walking through your own work in depth'],
  [41, 'Leadership and ownership', 'behavioral', null],
  [42, 'Collaboration and conflict', 'behavioral', null],
]
export const topics: Topic[] = T.map(([id, name, category, description]) => ({ id, name, category, description }))

const P = 'p-whatnot'

export const researchProfiles: ResearchProfile[] = [
  {
    id: P,
    company_id: 'c-whatnot',
    role_id: 'r-mle-growth',
    status: 'done',
    summary:
      'Whatnot runs a recruiter screen, a technical screen (medium Python coding plus ML fundamentals), then a virtual onsite. The onsite mixes ML system design around live-shopping discovery, software engineering (DSA, Python, SQL), a distinctive product sense round, and a values round. It is practical and product-minded: interviewers want engineers who think like users of the app.',
    style_notes: [
      'Practical and scenario-based, not abstract puzzles. Interviewers reward trade-off reasoning and starting with a simple baseline.',
      'MLEs are treated as software engineers first: clean Python, SQL and productionizing models matter as much as modeling.',
      'Product sense is the distinctive round. Expect opinions on the Whatnot app, ideas to improve it, and diagnosing underperforming categories. Use the app as a buyer before interviewing.',
      'ML design centers on real-time marketplace discovery: livestream and product recommendations that react to inventory changes within minutes.',
      'Company values stress velocity, ownership and dogfooding.',
    ],
    level_notes:
      'The MLE guide expects about 4+ years shipping ML to production, with full lifecycle ownership from data through deployment. No source maps levels to different rounds.',
    confidence: 'low',
    gaps: [
      'Only one detailed MLE candidate report (Jan 2026); most round detail comes from third-party guides.',
      'Round lengths and the number of onsite coding rounds are not reported for MLE.',
      '1point3acres reports were login-gated.',
      'Nothing specific to the Growth team; the posting will cover that in the blueprint step.',
    ],
    researched_at: '2026-10-16T20:19:42Z',
  },
]

const S = { guide: 's1', report: 's2', sweReports: 's3', sweGuide: 's4', press: 's5', forum: 's6' }

export const profileSources: ProfileSource[] = [
  { id: S.guide, profile_id: P, url: 'https://dataford.io/interview-guides/whatnot/machine-learning-engineer', title: 'Whatnot Machine Learning Engineer interview guide (dataford)', kind: 'guide' },
  { id: S.report, profile_id: P, url: 'https://prachub.com/interview-experiences/whatnot-machine-learning-engineer-interview-experience-a-weird-product-sense-round-then-silence', title: 'Whatnot MLE interview experience, Jan 2026 (PracHub)', kind: 'candidate_report' },
  { id: S.sweReports, profile_id: P, url: 'https://dataford.io/interview-guides/whatnot/software-engineer/experiences', title: 'Whatnot Software Engineer interview experiences (dataford)', kind: 'candidate_report' },
  { id: S.sweGuide, profile_id: P, url: 'https://prachub.com/interview-guide/whatnot-software-engineer-interview-questions-guide-2026', title: 'Whatnot Software Engineer interview guide 2026 (PracHub)', kind: 'guide' },
  { id: S.press, profile_id: P, url: 'https://www.modernretail.co/technology/marketplace-briefing-how-whatnots-ai-powered-recommendation-system-gives-it-a-competitive-edge/', title: "How Whatnot's AI-powered recommendation system gives it an edge (Modern Retail, Jul 2026)", kind: 'other' },
  { id: S.forum, profile_id: P, url: 'https://www.1point3acres.com/interview/thread/1063359', title: 'Whatnot interview experience and process overview (1point3acres)', kind: 'forum' },
]

export const profileRounds: ProfileRound[] = [
  { id: 'rd1', profile_id: P, position: 1, name: 'Recruiter screen', type: 'recruiter_screen', count: 1, minutes: null, what_it_tests: 'Background, interests and fit for the role.', source_ids: [S.guide, S.report] },
  { id: 'rd2', profile_id: P, position: 2, name: 'Technical screen', type: 'coding', count: 1, minutes: 60, what_it_tests: 'Medium coding in clean, readable Python plus a check of core ML fundamentals. Some SWE candidates report a recorded one-way pre-screen or a Karat-run screen first.', source_ids: [S.guide, S.sweReports, S.sweGuide] },
  { id: 'rd3', profile_id: P, position: 3, name: 'Hiring manager interview', type: 'behavioral', count: 1, minutes: 30, what_it_tests: 'Your background and interests, and your ideas for improving Whatnot.', source_ids: [S.report] },
  { id: 'rd4', profile_id: P, position: 4, name: 'ML system design', type: 'ml_system_design', count: 1, minutes: null, what_it_tests: 'Designing ML systems for search, recommendations or fraud in a live marketplace: retrieval vs ranking, features, offline vs online metrics, model complexity vs latency. One reported prompt was integrating an existing model into a trending-livestreams service.', source_ids: [S.guide, S.report, S.press] },
  { id: 'rd5', profile_id: P, position: 5, name: 'Software engineering', type: 'coding', count: null, minutes: 60, what_it_tests: 'Data structures and algorithms in Python, SQL for pulling training data and analyzing results, and productionizing models. Reasoning is weighed as well as the final answer.', source_ids: [S.guide, S.sweReports, S.sweGuide] },
  { id: 'rd6', profile_id: P, position: 6, name: 'Product sense', type: 'other', count: 1, minutes: null, what_it_tests: 'Turning vague business goals into ML problems, A/B test design, marketplace dynamics, and opinions on the Whatnot app, including finding underperforming categories and debugging a product issue.', source_ids: [S.guide, S.report, S.forum] },
  { id: 'rd7', profile_id: P, position: 7, name: 'Company principles', type: 'behavioral', count: 1, minutes: null, what_it_tests: 'STAR-style stories about ownership, speed and collaboration.', source_ids: [S.guide, S.sweGuide] },
]

const RT: [string, number, number, string][] = [
  ['rd1', 40, 0.4, 'Quick overview of your ML work and why Whatnot'],
  ['rd2', 1, 0.6, 'Medium problems; clean, readable Python is emphasized'],
  ['rd2', 7, 0.3, 'Graph problems reported in Whatnot coding rounds'],
  ['rd2', 19, 0.3, 'Baseline ML fundamentals check'],
  ['rd2', 18, 0.2, 'Baseline ML fundamentals check'],
  ['rd3', 40, 0.6, 'Background walk-through'],
  ['rd3', 41, 0.3, 'Come with concrete ideas to improve the Whatnot app'],
  ['rd4', 30, 0.9, 'Livestream and product recommendations, trending streams, routing buyers to the right shows'],
  ['rd4', 31, 0.6, 'Retrieval vs ranking; Whatnot is building real-time retrieval for search and feeds'],
  ['rd4', 34, 0.6, 'Minute-level real-time features, e.g. an item selling out mid-show'],
  ['rd4', 19, 0.6, 'Offline vs online metrics tied to watch time and clicks'],
  ['rd4', 36, 0.5, 'Model complexity vs latency trade-offs in live shows'],
  ['rd4', 33, 0.4, 'Fraud in a live marketplace'],
  ['rd4', 37, 0.3, 'Making sure data reflects reality, e.g. a stream is actually live'],
  ['rd5', 1, 0.6, 'Hash maps and strings, LeetCode medium'],
  ['rd5', 7, 0.4, 'Reported in Whatnot coding rounds'],
  ['rd5', 14, 0.5, 'SQL for pulling training data and analyzing results'],
  ['rd5', 36, 0.3, 'Productionizing models: serving, containers, latency'],
  ['rd6', 23, 0.8, 'Designing and reading A/B tests for marketplace changes'],
  ['rd6', 19, 0.5, 'Choosing metrics to find underperforming categories'],
  ['rd6', 37, 0.3, 'Debugging a suspected product bug; reproducing it in the app beats over-engineering'],
  ['rd7', 41, 0.8, 'Ownership and shipping fast'],
  ['rd7', 42, 0.6, 'Disagreements with senior engineers or PMs'],
  ['rd7', 40, 0.4, 'Stories with evidence and what you would change'],
]
export const roundTopics: RoundTopic[] = RT.map(([round_id, topic_id, weight, detail]) => ({ round_id, topic_id, weight, detail }))

const F: [number, number, number, number, number, string][] = [
  [19, 1.4, 1.2, 1, 0.1, 'research: Whatnot ML system design, Whatnot Product sense, Whatnot Technical screen; posting: conversion and revenue signals'],
  [30, 0.9, 1.4, 1.3, 0.0975, 'research: Whatnot ML system design; posting: ranking, personalization, notification ranking; resume: no ranking or recommender work yet; key gap for Whatnot'],
  [1, 1.2, 1, 1.2, 0.0857, 'research: Whatnot Software engineering, Whatnot Technical screen; resume: data science background, no DSA interview prep shown'],
  [40, 1.4, 1, 1, 0.0833, 'research: Whatnot Company principles, Whatnot Hiring manager interview, Whatnot Recruiter screen'],
  [41, 1.1, 1.3, 0.9, 0.0766, 'research: Whatnot Company principles, Whatnot Hiring manager interview; posting: lead and own the full ML lifecycle; resume: founding ML engineer, end-to-end ownership'],
  [23, 0.8, 1.5, 0.8, 0.0571, 'research: Whatnot Product sense; posting: online experimentation, uplift; resume: led A/B and diff-in-diff tests, causal inference'],
  [36, 0.8, 1.1, 1, 0.0524, 'research: Whatnot ML system design, Whatnot Software engineering; posting: productionization'],
  [7, 0.7, 1, 1.2, 0.05, 'research: Whatnot Software engineering, Whatnot Technical screen; resume: data science background, no DSA interview prep shown'],
  [37, 0.6, 1.1, 1.1, 0.0432, 'research: Whatnot ML system design, Whatnot Product sense; posting: retention models in production; resume: no production monitoring shown'],
  [31, 0.6, 1, 1.2, 0.0428, 'research: Whatnot ML system design; resume: only vector similarity matching'],
  [42, 0.6, 1.2, 1, 0.0428, 'research: Whatnot Company principles; posting: cross-functional alignment'],
  [34, 0.6, 1.2, 0.9, 0.0386, 'research: Whatnot ML system design; posting: data pipelines; resume: built data pipelines; no real-time feature store shown'],
  [14, 0.5, 1.2, 0.7, 0.025, 'research: Whatnot Software engineering; posting: SQL; resume: heavy SQL and pandas work'],
  [33, 0.4, 1, 1, 0.0238, 'research: Whatnot ML system design'],
  [18, 0.2, 1, 1, 0.0119, 'research: Whatnot Technical screen'],
  [32, 0, 1.3, 1.1, 0.0085, 'not in research (minimum weight); posting: targeting, acquisition, conversion signals; resume: ad attribution, but no CTR/conversion modeling'],
  [20, 0, 1.3, 1, 0.0077, 'not in research (minimum weight); posting: feature engineering'],
  [15, 0, 1.2, 1, 0.0071, 'not in research (minimum weight); posting: uplift modeling and experiments'],
  [28, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: limited embedding work'],
  [2, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: DSA gap'],
  [3, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: DSA gap'],
  [6, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: DSA gap'],
  [4, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: DSA gap'],
  [8, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: DSA gap'],
  [9, 0, 1, 1.1, 0.0065, 'not in research (minimum weight); resume: DSA gap'],
  [22, 0, 1.1, 1, 0.0065, 'not in research (minimum weight); posting: user segmentation'],
  [10, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [29, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [5, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [25, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [38, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [39, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [24, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [21, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [16, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [12, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [11, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [26, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [13, 0, 1, 1, 0.006, 'not in research (minimum weight)'],
  [35, 0, 1.2, 0.8, 0.0057, 'not in research (minimum weight); posting: feedback loops from postbacks and conversions; resume: 30+ Airflow/Spark DAGs, attribution pipeline'],
  [17, 0, 1.2, 0.8, 0.0057, 'not in research (minimum weight); posting: XGBoost; resume: XGBoost in production'],
  [27, 0, 1, 0.8, 0.0048, 'not in research (minimum weight); resume: RAG, GPT and LlamaIndex projects'],
]
export const focusTopics: FocusTopic[] = F.map(([topic_id, research_score, posting_factor, resume_factor, weight, reason]) => ({
  user_id: U,
  topic_id,
  research_score,
  posting_factor,
  resume_factor,
  weight,
  reason,
  updated_at: '2026-10-16T21:05:36Z',
}))

const batch = new Date().toISOString()

export const questions: Question[] = [
  {
    id: 'q1',
    user_id: U,
    topic_id: 37,
    company_id: 'c-whatnot',
    format: 'ml_system_design',
    difficulty: 3,
    minutes: 25,
    prompt:
      "You own a model at Whatnot that scores new buyers each day to decide who gets a re-engagement push in their first week. Two months after launch, the campaign's lift in 7-day retention has fallen from about +4% to roughly zero, yet offline AUC on recent data looks unchanged. Walk through how you would diagnose this, and what monitoring you would put in place so it gets caught earlier next time.",
    rubric: [
      'Separates model decay from a policy problem: the model now trains on data shaped by its own pushes (feedback loop)',
      'Checks for pipeline breaks and shifts in feature and label distributions, not just AUC',
      'Verifies the holdout still exists, is randomized, and is big enough to measure lift',
      'Considers notification fatigue or channel saturation as a cause unrelated to the model',
      'Proposes concrete monitors: feature drift (e.g. PSI), prediction distribution, calibration, online lift against a persistent holdout, with alert thresholds',
      'Gives a retraining or exploration strategy so future data stays unbiased',
    ],
    created_at: batch,
  },
  {
    id: 'q2',
    user_id: U,
    topic_id: 14,
    company_id: 'c-whatnot',
    format: 'ml_coding',
    difficulty: 3,
    minutes: 15,
    prompt: `Whatnot wants to know how quickly new buyers start buying. For each **weekly cohort** of new buyers (the week of their \`first_seen_at\`), return:

- \`new_buyers\`: how many buyers were first seen that week.
- \`conversion_rate_7d\`: the share of them whose first purchase came within 7 days of \`first_seen_at\`.
- \`median_hours_join_to_purchase\`: among those 7-day converters, the median hours from their first show join to their first purchase.

### Tables

**buyers**

| Column | Type |
|---|---|
| buyer_id | int (primary key) |
| first_seen_at | timestamp |

**show_events**

| Column | Type |
|---|---|
| buyer_id | int |
| show_id | int |
| event_type | text: \`'join'\` or \`'purchase'\` |
| ts | timestamp |

### Example

**buyers**

| buyer_id | first_seen_at |
|---|---|
| 1 | 2026-09-07 10:00 |
| 2 | 2026-09-08 09:00 |
| 3 | 2026-09-09 18:00 |
| 4 | 2026-09-15 12:00 |
| 5 | 2026-09-16 08:00 |

**show_events**

| buyer_id | show_id | event_type | ts |
|---|---|---|---|
| 1 | 101 | join | 2026-09-07 10:30 |
| 1 | 101 | purchase | 2026-09-07 12:30 |
| 2 | 102 | join | 2026-09-08 09:15 |
| 2 | 105 | purchase | 2026-09-20 20:00 |
| 3 | 103 | join | 2026-09-10 20:00 |
| 3 | 104 | join | 2026-09-11 08:00 |
| 3 | 104 | purchase | 2026-09-11 14:00 |
| 4 | 106 | join | 2026-09-15 13:00 |
| 4 | 106 | purchase | 2026-09-15 19:00 |

**Expected output**

| cohort_week | new_buyers | conversion_rate_7d | median_hours_join_to_purchase |
|---|---|---|---|
| 2026-09-07 | 3 | 0.67 | 10.0 |
| 2026-09-14 | 2 | 0.50 | 6.0 |

### Explanation

- **Week of Sep 7:** buyers 1, 2 and 3. Buyer 1 bought 2 hours after joining. Buyer 2 bought on Sep 20, more than 7 days after first being seen, so does not count. Buyer 3's first join was Sep 10 20:00 and first purchase Sep 11 14:00, which is 18 hours. Rate = 2/3; median of 2 and 18 = 10.0.
- **Week of Sep 14:** buyers 4 and 5. Buyer 4 bought 6 hours after joining. Buyer 5 has no events but still counts as a new buyer. Rate = 1/2; median = 6.0.

Write it in PostgreSQL. Weeks start on Monday (\`date_trunc('week', ...)\`).`,
    rubric: [
      'Cohorts buyers by the week of first_seen_at',
      "Finds each buyer's first purchase and first join with MIN over the right event type",
      'Keeps non-converting buyers in the denominator (left join, not inner)',
      'Applies the 7-day window correctly relative to first_seen_at',
      'Computes the median with percentile_cont (or equivalent) only over converters',
      'Handles edge cases such as a purchase with no prior join, and uses readable CTEs',
    ],
    created_at: batch,
  },
  {
    id: 'q3',
    user_id: U,
    topic_id: 40,
    company_id: 'c-whatnot',
    format: 'behavioral',
    difficulty: 3,
    minutes: 15,
    prompt:
      'Pick the project you are proudest of. Your lead-to-designer matching system (XGBoost plus mixed integer programming) is a strong candidate. In about 5 minutes, explain the business problem, why you paired a model with an optimizer, how you measured the 6-8% close-rate lift, and one thing you would do differently. Expect follow-ups on how you ruled out seasonality or other confounders.',
    rubric: [
      'States the problem and why it mattered in the first 30 seconds',
      'Explains why prediction alone was not enough (capacity and assignment constraints)',
      'Describes how the lift was measured (holdout, A/B or diff-in-diff) and the confounders considered',
      'Quantifies impact and ties it to revenue',
      'Makes clear which decisions were yours and what trade-offs you made',
      'Gives an honest, specific reflection on what to change',
    ],
    created_at: batch,
  },
]

function isoDaysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// One graded attempt at the SQL question, so the feedback view has something to show.
export const answers: Answer[] = [
  {
    id: 'a1',
    user_id: U,
    question_id: 'q2',
    body: `with first_purchase as (
  select buyer_id, min(ts) as purchased_at
  from show_events where event_type = 'purchase'
  group by buyer_id
),
first_join as (
  select buyer_id, min(ts) as joined_at
  from show_events where event_type = 'join'
  group by buyer_id
)
select date_trunc('week', b.first_seen_at) as cohort_week,
       count(*) as new_buyers,
       avg(case when p.purchased_at <= b.first_seen_at + interval '7 days' then 1 else 0 end) as converted_7d,
       percentile_cont(0.5) within group (
         order by extract(epoch from p.purchased_at - j.joined_at) / 3600
       ) as median_hours_join_to_purchase
from buyers b
join first_purchase p on p.buyer_id = b.buyer_id
join first_join j on j.buyer_id = b.buyer_id
group by 1
order by 1;`,
    seconds_spent: 840,
    status: 'graded',
    created_at: batch,
  },
]

export const grades: Grade[] = [
  {
    answer_id: 'a1',
    score: 3,
    rubric_scores: [
      { point: 'Cohorts buyers by the week of first_seen_at', verdict: 'met', note: "date_trunc('week', b.first_seen_at) groups the cohorts correctly." },
      { point: "Finds each buyer's first purchase and first join with MIN over the right event type", verdict: 'met', note: 'Two clean CTEs, each filtered to one event type.' },
      { point: 'Keeps non-converting buyers in the denominator (left join, not inner)', verdict: 'missed', note: 'Inner joins drop every buyer who never purchased, so new_buyers and the conversion rate only count converters.' },
      { point: 'Applies the 7-day window correctly relative to first_seen_at', verdict: 'partial', note: 'The window check is right, but the median ignores it and includes purchases after day 7.' },
      { point: 'Computes the median with percentile_cont (or equivalent) only over converters', verdict: 'partial', note: 'percentile_cont is the right tool; it needs a filter so only 7-day converters count.' },
      { point: 'Handles edge cases such as a purchase with no prior join, and uses readable CTEs', verdict: 'partial', note: 'Readable CTEs, but a purchase before any join gives negative hours and is not handled.' },
    ],
    strengths: ['Clear CTE structure that is easy to follow out loud.', 'Picked percentile_cont for the median without being prompted.'],
    improvements: [
      'Start from buyers and LEFT JOIN the event CTEs, so non-converters stay in the denominator.',
      "Filter the median to converters within 7 days: percentile_cont(...) within group (...) filter (where p.purchased_at <= b.first_seen_at + interval '7 days').",
      'Say out loud how you treat a purchase with no earlier join; interviewers listen for edge cases.',
    ],
    model_answer: `with first_purchase as (
  select buyer_id, min(ts) as purchased_at
  from show_events where event_type = 'purchase' group by buyer_id
),
first_join as (
  select buyer_id, min(ts) as joined_at
  from show_events where event_type = 'join' group by buyer_id
),
cohort as (
  select b.buyer_id,
         date_trunc('week', b.first_seen_at) as cohort_week,
         p.purchased_at <= b.first_seen_at + interval '7 days' as converted,
         extract(epoch from p.purchased_at - j.joined_at) / 3600 as hours_to_purchase
  from buyers b
  left join first_purchase p using (buyer_id)
  left join first_join j using (buyer_id)
)
select cohort_week,
       count(*) as new_buyers,
       avg(coalesce(converted, false)::int) as converted_7d,
       percentile_cont(0.5) within group (order by hours_to_purchase)
         filter (where converted and hours_to_purchase >= 0) as median_hours_join_to_purchase
from cohort
group by cohort_week
order by cohort_week;`,
    graded_at: batch,
  },
]
