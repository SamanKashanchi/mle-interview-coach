import type { DependencyList } from 'react'
import { db } from './db'
import { useAsync } from './useAsync'
import {
  activityByDay,
  localDay,
  topicStats,
  type Day,
} from './progress'
import type { FocusTopicView, HistoryItemView, Profile } from './types'

export type Progress = ReturnType<typeof buildProgress>

export function buildProgress(items: HistoryItemView[], focus: FocusTopicView[], profile: Profile | null, today: Day = localDay()) {
  const activity = activityByDay(items)
  const stats = topicStats(items, focus)
  return {
    items,
    focus,
    profile,
    today,
    activity,
    stats,
  }
}

/** History, focus plan and profile, with everything the habit loop derives from them. */
export function useProgress(deps: DependencyList = []) {
  return useAsync(async () => {
    const [items, focus, profile] = await Promise.all([db.getHistory(), db.getFocusTopics(), db.getProfile()])
    return buildProgress(items, focus, profile)
  }, deps)
}
