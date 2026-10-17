import { Link } from 'react-router-dom'
import { ChevronRight, CircleDashed, RotateCcw, Trophy } from 'lucide-react'
import { plainPreview } from '../lib/format'
import { addDays, fmtScore, type TopicStat } from '../lib/progress'
import type { Progress } from '../lib/useProgress'
import type { HistoryItemView } from '../lib/types'
import { cx } from '../lib/cx'
import { Badge } from './ui'
import { LevelPill, OnceToasts } from './habit'
import { QuestionMeta } from '../pages/question/meta'

/** A question in a list: topic, level, preview, meta, and its grade or status. */
export function QuestionCard({ h, n, stat, review }: { h: HistoryItemView; n?: number; stat?: TopicStat; review?: boolean }) {
  return (
    <Link to={`/questions/${h.id}`} className="group block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50 sm:p-6">
      <div className="flex items-start gap-4">
        {n != null && (
          <span
            aria-hidden
            className={cx(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              h.answer_id ? 'bg-accent text-accent-ink' : 'bg-raised text-muted',
            )}
          >
            {n}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold">{h.topic.name}</p>
            {review && (
              <Badge tone="accent">
                <RotateCcw aria-hidden className="size-3" /> Review
              </Badge>
            )}
          </div>
          {stat && <LevelPill level={stat.level} className="mt-1" />}
          <p className="mt-2 line-clamp-2 text-sm text-muted">{plainPreview(h.prompt)}</p>
          <QuestionMeta q={h} className="mt-4" />
          {h.answer_id && h.score == null && (
            <div className="mt-3">
              <Badge tone="warn">
                <CircleDashed aria-hidden className="size-3.5" /> Answered, waiting for a grade
              </Badge>
            </div>
          )}
        </div>
        {h.score != null ? (
          <div className="shrink-0 text-right">
            <p className="text-3xl font-semibold leading-none tabular-nums">{fmtScore(h.score)}</p>
            <p className="mt-1 text-xs text-muted">of 5</p>
          </div>
        ) : (
          <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
    </Link>
  )
}


/** A toast for each milestone earned in the last few days, once per device. */
export function MilestoneToasts({ p }: { p: Progress }) {
  const recent = p.milestones.filter((m) => m.earned && m.on && m.on >= addDays(p.today, -2))
  return <OnceToasts items={recent.map((m) => ({ id: `milestone:${m.id}`, icon: <Trophy className="size-5" />, message: <><span className="font-semibold">Milestone: {m.title}.</span> {m.detail}</> }))} />
}

