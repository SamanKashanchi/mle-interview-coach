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
  created_at: string
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
