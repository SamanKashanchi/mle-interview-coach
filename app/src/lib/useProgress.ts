import type { DependencyList } from 'react'
import { db } from './db'
import { useAsync } from './useAsync'
import {
  activityByDay,
  localDay,
  milestones,
  projectReadiness,
  readinessSeries,
  streak,
  topicStats,
  type Day,
} from './progress'
import type { FocusTopicView, HistoryItemView, Profile } from './types'

export type Progress = ReturnType<typeof buildProgress>

export function buildProgress(items: HistoryItemView[], focus: FocusTopicView[], profile: Profile | null, today: Day = localDay()) {
  const activity = activityByDay(items)
  const st = streak(new Set(activity.keys()), today)
  const stats = topicStats(items, focus)
  const series = readinessSeries(items, focus, today)
  return {
    items,
    focus,
    profile,
    today,
    activity,
    streak: st,
    stats,
    series,
    readiness: series[series.length - 1].value,
    projected: projectReadiness(items, series, profile?.ready_by ?? null),
    milestones: milestones(items, st, stats),
  }
}

/** History, focus plan and profile, with everything the habit loop derives from them. */
export function useProgress(deps: DependencyList = []) {
  return useAsync(async () => {
    const [items, focus, profile] = await Promise.all([db.getHistory(), db.getFocusTopics(), db.getProfile()])
    return buildProgress(items, focus, profile)
  }, deps)
}
