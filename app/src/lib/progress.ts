// Everything the habit loop shows (streak, goal ring, mastery, readiness, reviews, milestones)
// is computed here from question history. Pure functions, so mock and real data behave the same.
// The question generator uses the same formulas (agents/questions/README.md).

import { formatDate } from './format'
import type { FocusTopicView, HistoryItemView, QuestionFormat } from './types'

/** A local calendar day, yyyy-mm-dd. */
export type Day = string

export function localDay(d: Date | string = new Date()): Day {
  const date = typeof d === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)) : d
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

export function addDays(day: Day, n: number): Day {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localDay(d)
}

export function daysBetween(from: Day, to: Day) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

/** 4 -> "4", 2.5 -> "2.5", 3.333 -> "3.3" */
export const fmtScore = (n: number) => String(Math.round(n * 10) / 10)

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// ---- Mastery ----

/** Bayesian average on 0-1: a prior of 2.5/5 worth two answers, so one 5/5 isn't mastery. */
export function mastery(scores: number[]) {
  return (scores.reduce((a, b) => a + b, 0) + 2.5 * 2) / (scores.length + 2) / 5
}

export type Level = 'not_started' | 'learning' | 'practiced' | 'solid' | 'ready'
export const LEVELS: Level[] = ['not_started', 'learning', 'practiced', 'solid', 'ready']
export const LEVEL_LABEL: Record<Level, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  practiced: 'Practiced',
  solid: 'Solid',
  ready: 'Interview-ready',
}

export function levelFor(scores: number[]): Level {
  if (!scores.length) return 'not_started'
  const m = mastery(scores)
  if (m < 0.45) return 'learning'
  if (m < 0.65) return 'practiced'
  if (m < 0.85 || scores.length < 2) return 'solid'
  return 'ready'
}

const graded = (items: HistoryItemView[]) =>
  items.filter((h) => h.score != null && h.graded_at).sort((a, b) => a.graded_at!.localeCompare(b.graded_at!))

/** Graded scores per topic, oldest first. `before` (ISO time) keeps only grades given earlier. */
export function scoresByTopic(items: HistoryItemView[], opts: { before?: string; excludeId?: string } = {}) {
  const out = new Map<number, number[]>()
  for (const h of graded(items)) {
    if (opts.before && h.graded_at! >= opts.before) continue
    if (h.id === opts.excludeId) continue
    out.set(h.topic_id, [...(out.get(h.topic_id) ?? []), h.score!])
  }
  return out
}

export interface TopicStat {
  topic_id: number
  name: string
  weight: number
  asked: number
  answered: number
  scores: number[]
  avg: number | null
  mastery: number
  level: Level
  lastAsked: Day | null
  /** The most recent question on this topic. */
  lastItem: HistoryItemView | null
}

export function topicStats(items: HistoryItemView[], focus: FocusTopicView[]): TopicStat[] {
  const scores = scoresByTopic(items)
  return focus.map((f) => {
    const mine = items.filter((h) => h.topic_id === f.topic_id)
    const s = scores.get(f.topic_id) ?? []
    return {
      topic_id: f.topic_id,
      name: f.topic.name,
      weight: f.weight,
      asked: mine.length,
      answered: mine.filter((h) => h.answer_id).length,
      scores: s,
      avg: mean(s),
      mastery: mastery(s),
      level: levelFor(s),
      lastAsked: mine.length ? mine[mine.length - 1].set_date : null,
      lastItem: mine[mine.length - 1] ?? null,
    }
  })
}

// ---- Readiness: the north-star number ----

/**
 * Sum of focus weight x mastery. Topics with no grade count as 0 here (no evidence yet),
 * so readiness starts at 0% and only grows with graded answers.
 */
export function readiness(scores: Map<number, number[]>, focus: FocusTopicView[]) {
  return focus.reduce((sum, f) => {
    const s = scores.get(f.topic_id)
    return sum + (s?.length ? f.weight * mastery(s) : 0)
  }, 0)
}

/** Readiness at the end of each of the last `days` days. */
export function readinessSeries(items: HistoryItemView[], focus: FocusTopicView[], today: Day, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1)
    const end = new Date(`${addDays(day, 1)}T00:00:00`).toISOString()
    return { day, value: readiness(scoresByTopic(items, { before: end }), focus) }
  })
}

/**
 * Where readiness is heading by the ready-by date. Mastery saturates (each point is harder to
 * earn than the last), so the gap to 100% is assumed to shrink at the rate it shrank over the
 * series, not to close in a straight line. Needs grades on at least 3 different days.
 */
export function projectReadiness(items: HistoryItemView[], series: { day: Day; value: number }[], readyBy: Day | null) {
  if (!readyBy || series.length < 2) return null
  const first = series[0].day
  const gradedDays = new Set(graded(items).map((h) => localDay(h.graded_at!)).filter((d) => d >= first))
  if (gradedDays.size < 3) return null
  const start = series[0].value
  const now = series[series.length - 1].value
  if (now <= start) return now
  const span = daysBetween(first, series[series.length - 1].day)
  const rate = Math.log((1 - start) / (1 - now)) / span // per day
  const ahead = Math.max(0, daysBetween(series[series.length - 1].day, readyBy))
  return 1 - (1 - now) * Math.exp(-rate * ahead)
}

// ---- Activity, streak and freezes ----

export interface DayActivity {
  day: Day
  answered: number
  scores: number[]
  avg: number | null
  minutes: number
}

/** Per local day: questions answered that day, their grades, and minutes practiced. */
export function activityByDay(items: HistoryItemView[]) {
  const out = new Map<Day, DayActivity>()
  const get = (day: Day) => {
    if (!out.has(day)) out.set(day, { day, answered: 0, scores: [], avg: null, minutes: 0 })
    return out.get(day)!
  }
  for (const h of items) {
    const days = new Set(h.answered_ats.map((t) => localDay(t)))
    for (const day of days) {
      const a = get(day)
      a.answered++
      if (h.score != null && h.answered_at && localDay(h.answered_at) === day) a.scores.push(h.score)
    }
    if (h.answered_at) get(localDay(h.answered_at)).minutes += practiceMinutes(h)
  }
  for (const a of out.values()) a.avg = mean(a.scores)
  return out
}

/** Minutes credited for the latest answer: time spent, capped at the question's length. */
export const practiceMinutes = (h: HistoryItemView) =>
  h.answered_at ? Math.min(h.seconds_spent ?? h.minutes * 60, h.minutes * 60) / 60 : 0

export interface Streak {
  current: number
  longest: number
  freezes: number
  frozen: Set<Day>
  answeredToday: boolean
  /** Days on which the streak reached 7 and 30, for milestones. */
  reached: Partial<Record<7 | 30, Day>>
}

/** Duolingo-style: a day counts with one answer, every 7 days earns a freeze (bank 2). */
export function streak(activeDays: Set<Day>, today: Day): Streak {
  const out: Streak = { current: 0, longest: 0, freezes: 0, frozen: new Set(), answeredToday: activeDays.has(today), reached: {} }
  const sorted = [...activeDays].sort()
  if (!sorted.length) return out
  for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
    if (activeDays.has(d)) {
      out.current++
      out.longest = Math.max(out.longest, out.current)
      if (out.current % 7 === 0) out.freezes = Math.min(2, out.freezes + 1)
      for (const n of [7, 30] as const) if (out.current === n && !out.reached[n]) out.reached[n] = d
    } else if (d === today) {
      // Today isn't over yet.
    } else if (out.freezes > 0) {
      out.freezes--
      out.frozen.add(d)
    } else {
      out.current = 0
    }
  }
  return out
}

// ---- Spaced review (Anki-style) ----

const INTERVALS = [1, 3, 7]

/**
 * When a topic is next due for review, from its grades given before `before`. A grade under 3
 * makes it due the next day; each later pass pushes it out to 3, then 7 days; a third pass
 * clears it. Any grade under 3 starts over.
 */
export function reviewDue(items: HistoryItemView[], topicId: number, before?: string): Day | null {
  let step = -1
  let due: Day | null = null
  for (const h of graded(items)) {
    if (h.topic_id !== topicId || (before && h.graded_at! >= before)) continue
    if (h.score! < 3) {
      step = 0
      due = addDays(h.set_date, INTERVALS[0])
    } else if (step >= 0) {
      step++
      due = step < INTERVALS.length ? addDays(h.set_date, INTERVALS[step]) : null
      if (!due) step = -1
    }
  }
  return due
}

/** A question is a review when its topic was due by the day it was set. */
export function isReview(items: HistoryItemView[], q: Pick<HistoryItemView, 'topic_id' | 'set_date' | 'created_at'>) {
  const due = reviewDue(items, q.topic_id, q.created_at)
  return !!due && due <= q.set_date
}

/** Topics due today or earlier that no question has picked up yet. */
export function dueReviews(items: HistoryItemView[], today: Day) {
  const topics = [...new Set(items.map((h) => h.topic_id))]
  return topics.flatMap((topic_id) => {
    const due = reviewDue(items, topic_id)
    if (!due || due > today) return []
    if (items.some((h) => h.topic_id === topic_id && h.set_date >= due)) return []
    return [{ topic_id, due }]
  })
}

// ---- Days and sets ----

export interface DaySummary {
  day: Day
  items: HistoryItemView[]
  answered: number
  avg: number | null
}

/** Questions grouped by the day they were set, newest day first. */
export function groupByDay(items: HistoryItemView[]): DaySummary[] {
  const days = new Map<Day, HistoryItemView[]>()
  for (const h of items) days.set(h.set_date, [...(days.get(h.set_date) ?? []), h])
  return [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({
      day,
      items: list,
      answered: list.filter((h) => h.answer_id).length,
      avg: mean(list.flatMap((h) => (h.score == null ? [] : [h.score]))),
    }))
}

/** Sets within a day: questions written in the same batch share a created_at minute. */
export function setsOf(items: HistoryItemView[]) {
  const sets = new Map<string, HistoryItemView[]>()
  for (const h of items) {
    const key = h.created_at.slice(0, 16)
    sets.set(key, [...(sets.get(key) ?? []), h])
  }
  return [...sets.values()]
}

// ---- Milestones ----

export interface Milestone {
  id: string
  title: string
  detail: string
  earned: boolean
  /** Local day it was earned, for the one-time toast. */
  on?: Day
  href?: string
}

const ALL_FORMATS: QuestionFormat[] = ['coding', 'ml_coding', 'ml_concept', 'ml_system_design', 'system_design', 'behavioral']

export function milestones(items: HistoryItemView[], st: Streak, stats: TopicStat[]): Milestone[] {
  const g = graded(items)
  const five = g.find((h) => h.score === 5)

  // The biggest climb on any topic: a later grade at least 2 points above an earlier low.
  let comeback: { name: string; from: number; to: number; item: HistoryItemView } | null = null
  for (const t of stats) {
    const mine = g.filter((h) => h.topic_id === t.topic_id)
    for (let j = 1; j < mine.length; j++) {
      const low = Math.min(...mine.slice(0, j).map((h) => h.score!))
      const gain = mine[j].score! - low
      if (gain >= 2 && (!comeback || gain > comeback.to - comeback.from)) comeback = { name: t.name, from: low, to: mine[j].score!, item: mine[j] }
    }
  }

  const formats = new Set(items.filter((h) => h.answer_id).map((h) => h.format))
  const lastFormat = items.filter((h) => h.answered_at).sort((a, b) => a.answered_at!.localeCompare(b.answered_at!)).find((_, i, arr) =>
    new Set(arr.slice(0, i + 1).map((h) => h.format)).size === ALL_FORMATS.length,
  )
  const ready = stats.find((t) => t.level === 'ready')

  return [
    {
      id: 'first-five',
      title: 'First 5/5',
      detail: five ? `${five.topic.name}, ${formatDate(five.set_date, { month: 'short', day: 'numeric' })}` : 'Score a perfect answer',
      earned: !!five,
      on: five ? localDay(five.graded_at!) : undefined,
      href: five ? `/questions/${five.id}` : undefined,
    },
    {
      id: 'comeback',
      title: 'Comeback',
      detail: comeback ? `${comeback.name}: ${fmtScore(comeback.from)} → ${fmtScore(comeback.to)}` : 'Raise a topic by 2 points',
      earned: !!comeback,
      on: comeback ? localDay(comeback.item.graded_at!) : undefined,
      href: comeback ? `/questions/${comeback.item.id}` : undefined,
    },
    { id: 'streak-7', title: '7-day streak', detail: st.reached[7] ? 'A full week' : `${Math.min(st.longest, 7)} of 7 days`, earned: !!st.reached[7], on: st.reached[7] },
    { id: 'streak-30', title: '30-day streak', detail: st.reached[30] ? 'A full month' : `${Math.min(st.longest, 30)} of 30 days`, earned: !!st.reached[30], on: st.reached[30] },
    {
      id: 'all-formats',
      title: 'Every format',
      detail: `${formats.size} of ${ALL_FORMATS.length} formats answered`,
      earned: formats.size === ALL_FORMATS.length,
      on: lastFormat ? localDay(lastFormat.answered_at!) : undefined,
    },
    {
      id: 'topic-ready',
      title: 'Interview-ready',
      detail: ready ? ready.name : 'Get one topic to Interview-ready',
      earned: !!ready,
      on: ready?.lastItem?.graded_at ? localDay(ready.lastItem.graded_at) : undefined,
    },
  ]
}

/** Best single day by average grade, counting days with at least 2 graded answers. */
export function bestDay(activity: Map<Day, DayActivity>) {
  let best: DayActivity | null = null
  for (const a of activity.values()) if (a.scores.length >= 2 && (!best || a.avg! > best.avg!)) best = a
  return best
}

/** Average of graded answers given between two days, inclusive. */
export function averageBetween(activity: Map<Day, DayActivity>, from: Day, to: Day) {
  return mean([...activity.values()].filter((a) => a.day >= from && a.day <= to).flatMap((a) => a.scores))
}
