import type { Category, Confidence, QuestionFormat, RoundType, SourceKind } from './types'

export const FORMAT_LABEL: Record<QuestionFormat, string> = {
  coding: 'Coding',
  ml_coding: 'ML coding',
  ml_concept: 'ML concept',
  ml_system_design: 'ML system design',
  system_design: 'System design',
  behavioral: 'Behavioral',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  coding: 'Coding',
  ml_coding: 'ML coding',
  ml_fundamentals: 'ML fundamentals',
  deep_learning: 'Deep learning',
  ml_system_design: 'ML system design',
  system_design: 'System design',
  behavioral: 'Behavioral',
}

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[]

export const ROUND_LABEL: Record<RoundType, string> = {
  recruiter_screen: 'Recruiter screen',
  coding: 'Coding',
  ml_coding: 'ML coding',
  ml_fundamentals: 'ML fundamentals',
  ml_system_design: 'ML system design',
  system_design: 'System design',
  behavioral: 'Behavioral',
  resume_deep_dive: 'Resume deep dive',
  take_home: 'Take-home',
  other: 'Other',
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  official: 'Official',
  candidate_report: 'Candidate report',
  guide: 'Guide',
  forum: 'Forum',
  job_posting: 'Job posting',
  other: 'Article',
}

/** Whole days from today to a yyyy-mm-dd date, in local time. */
export function daysUntil(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  // Plain dates (yyyy-mm-dd) are read as local days, not UTC midnight.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString(undefined, opts)
}

export function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const pct = (w: number) => `${(w * 100).toFixed(w >= 0.1 ? 0 : 1)}%`
