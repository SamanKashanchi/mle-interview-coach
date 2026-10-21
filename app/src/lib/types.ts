// Row types that mirror supabase/schema.sql. Keep them in step with the database.

export type Category =
  | 'coding'
  | 'ml_coding'
  | 'ml_fundamentals'
  | 'deep_learning'
  | 'ml_system_design'
  | 'system_design'
  | 'behavioral'

export type QuestionFormat =
  | 'coding'
  | 'ml_coding'
  | 'ml_concept'
  | 'ml_system_design'
  | 'system_design'
  | 'behavioral'

export type RoundType =
  | 'recruiter_screen'
  | 'coding'
  | 'ml_coding'
  | 'ml_fundamentals'
  | 'ml_system_design'
  | 'system_design'
  | 'behavioral'
  | 'resume_deep_dive'
  | 'take_home'
  | 'other'

export type ResearchStatus = 'pending' | 'running' | 'done' | 'failed'
export type Confidence = 'low' | 'medium' | 'high'
export type SourceKind = 'official' | 'candidate_report' | 'guide' | 'forum' | 'job_posting' | 'other'

export interface Company {
  id: string
  name: string
}

export interface Role {
  id: string
  name: string
}

export interface Profile {
  user_id: string
  name: string | null
  level: string | null
  ready_by: string | null // yyyy-mm-dd
  minutes_per_day: number | null
  resume_path: string | null
  resume_name: string | null
  updated_at: string
}

export type ProfileInput = Partial<Pick<Profile, 'name' | 'level' | 'ready_by' | 'minutes_per_day' | 'resume_path' | 'resume_name'>>

export interface Target {
  id: string
  user_id: string
  company_id: string
  role_id: string
  job_description: string | null
  created_at: string
}

export interface Topic {
  id: number
  name: string
  category: Category
  description: string | null
}

export interface ResearchProfile {
  id: string
  company_id: string
  role_id: string
  status: ResearchStatus
  summary: string | null
  style_notes: string[]
  level_notes: string | null
  confidence: Confidence | null
  gaps: string[]
  researched_at: string | null
}

export interface ProfileRound {
  id: string
  profile_id: string
  position: number
  name: string
  type: RoundType
  count: number | null
  minutes: number | null
  what_it_tests: string | null
  source_ids: string[]
}

export interface RoundTopic {
  round_id: string
  topic_id: number
  weight: number
  detail: string | null
}

export interface ProfileSource {
  id: string
  profile_id: string
  url: string
  title: string | null
  kind: SourceKind | null
}

export interface FocusTopic {
  user_id: string
  topic_id: number
  research_score: number
  posting_factor: number
  resume_factor: number
  weight: number
  reason: string | null
  updated_at: string
}

export interface Question {
  id: string
  user_id: string
  topic_id: number
  company_id: string | null
  format: QuestionFormat
  difficulty: number
  minutes: number
  prompt: string
  rubric: string[]
  set_date: string // yyyy-mm-dd, the day this question belongs to
  reason: string | null // why the generator picked it
  code: CodeSpec | null // runnable starter code and tests, for coding questions
  created_at: string
}

// ---- Runnable coding questions (questions.code, answers.run_result) ----

export type CodeLanguage = 'python' | 'sql'

export interface SqlTable {
  columns: string[]
  rows: (string | number | null)[][]
}

/** One test case. Python cases call `entry(*args)`; SQL cases run `setup` after the schema. */
export interface CodeTest {
  name: string
  hidden: boolean
  args?: unknown[]
  setup?: string
  expected: unknown // Python: any JSON value. SQL: a SqlTable.
  ordered?: boolean // Compare list or row order. Default: Python yes, SQL no.
}

export interface CodeSpec {
  language: CodeLanguage
  starter: string
  entry?: string // Python: the function to call
  params?: string[] // Python: argument names, for showing inputs
  schema?: string // SQL: create table statements
  tests: CodeTest[]
}

/** A value shown in the console: Python repr text or a SQL result table. */
export type Shown = { text: string } | { table: SqlTable }

export interface CaseResult {
  name: string
  hidden: boolean
  status: 'pass' | 'fail' | 'error'
  inputs: { label: string; value: Shown }[]
  output: Shown | null
  expected: Shown
  stdout: string
  error: string | null
  ms: number
}

export type RunStatus = 'accepted' | 'wrong_answer' | 'runtime_error' | 'compile_error' | 'time_limit'

export interface RunResult {
  kind: 'run' | 'submit'
  status: RunStatus
  passed: number
  total: number
  error: string | null // compile error or time limit, when no case could run
  cases: CaseResult[]
  ms: number
  ran_at: string
}

// ---- Shapes the pages work with (rows joined with the names they point at) ----

export interface TargetView extends Target {
  company: string
  role: string
  research: Pick<ResearchProfile, 'id' | 'status' | 'confidence' | 'researched_at'> | null
}

export interface RoundView extends ProfileRound {
  topics: (RoundTopic & { topic: Topic })[]
}

export interface ResearchDetail {
  profile: ResearchProfile
  rounds: RoundView[]
  sources: ProfileSource[]
}

export interface FocusTopicView extends FocusTopic {
  topic: Topic
}

export interface QuestionView extends Question {
  topic: Topic
  company: string | null
}

export interface TargetInput {
  company: string
  role: string
  job_description: string | null
}

export interface SessionUser {
  id: string
  email: string
}

export type Verdict = 'met' | 'partial' | 'missed'

export interface RubricScore {
  point: string
  verdict: Verdict
  note: string
}

export interface Answer {
  id: string
  user_id: string
  question_id: string
  body: string
  seconds_spent: number | null
  status: 'pending' | 'graded'
  language: CodeLanguage | null // set for code answers
  run_result: RunResult | null // tests at submit time, for code answers
  audio_path: string | null // voice answers: the recording in the answer-audio bucket
  transcribed_at: string | null // voice answers: when the worker replaced body with the transcript
  created_at: string
}

export interface Grade {
  answer_id: string
  score: number
  rubric_scores: RubricScore[]
  strengths: string[]
  improvements: string[]
  model_answer: string | null
  graded_at: string
}

export interface AnswerView extends Answer {
  grade: Grade | null
}

/** One row of the question_history view: a question with its latest attempt and grade. */
export interface HistoryItem {
  id: string
  topic_id: number
  company_id: string | null
  company: string | null
  format: QuestionFormat
  difficulty: number
  minutes: number
  prompt: string
  set_date: string
  reason: string | null
  created_at: string
  answer_id: string | null
  answer_status: Answer['status'] | null
  answered_at: string | null
  seconds_spent: number | null
  score: number | null
  graded_at: string | null
  attempts: number
  answered_ats: string[]
}

export interface HistoryItemView extends HistoryItem {
  topic: Topic
}
