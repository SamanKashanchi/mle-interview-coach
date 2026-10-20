import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpenCheck, ChevronDown, CircleDashed, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useProgress, type Progress } from '../../lib/useProgress'
import { FORMAT_LABEL, formatDate, plainPreview, scoreLabel } from '../../lib/format'
import { addDays, averageBetween, fmtScore, groupByDay, type DaySummary } from '../../lib/progress'
import type { HistoryItemView, QuestionFormat } from '../../lib/types'
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonList } from '../../components/ui'
import { ActivityCalendar, DailyScores, LevelPill, ScorePill, Stat } from '../../components/habit'
import { Difficulty } from '../question/meta'
import { cx } from '../../lib/cx'

const RESULTS = {
  needs: 'Needs work',
  getting: 'Getting there',
  solid: 'Solid',
  ready: 'Interview-ready',
  pending: 'Waiting for a grade',
  unanswered: 'Unanswered',
} as const
type Result = keyof typeof RESULTS

function resultOf(h: HistoryItemView): Result {
  if (!h.answer_id) return 'unanswered'
  if (h.score == null) return 'pending'
  return ({ 'Needs work': 'needs', 'Getting there': 'getting', Solid: 'solid', 'Interview-ready': 'ready' } as const)[
    scoreLabel(h.score) as 'Needs work'
  ]
}

export default function History() {
  const { data, error, loading, reload } = useProgress()
  const header = <PageHeader title="History" subtitle="Every question you've had, what you wrote, and how it was graded." />

  if (error) return <>{header}<ErrorState message={error} onRetry={reload} /></>
  if (loading || !data) return <>{header}<HistorySkeleton /></>
  if (!data.items.length) {
    return (
      <>
        {header}
        <EmptyState icon={<BookOpenCheck className="size-6" />} title="Answer your first question to start your history">
          Your days, grades and weakest topics will collect here.
          <p className="mt-3">
            <Link to="/" className="font-medium text-accent-text underline-offset-2 hover:underline">Go to Today</Link>
          </p>
        </EmptyState>
      </>
    )
  }

  return (
    <>
      {header}
      <ProgressTiles p={data} />
      <Card className="mt-4">
        <h2 className="mb-4 font-semibold">Practice calendar</h2>
        <ActivityCalendar activity={data.activity} today={data.today} hasQuestions={new Set(data.items.map((h) => h.set_date))} />
      </Card>
      <Card className="mt-4">
        <DailyScores
          points={Array.from({ length: 14 }, (_, i) => {
            const day = addDays(data.today, i - 13)
            const a = data.activity.get(day)
            return { day, avg: a?.avg ?? null, answered: a?.answered ?? 0 }
          })}
        />
      </Card>
      <WeakSpots p={data} />
      <Days p={data} />
    </>
  )
}

function ProgressTiles({ p }: { p: Progress }) {
  const all = p.items.flatMap((h) => (h.score == null ? [] : [h.score]))
  const overall = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null
  const week = averageBetween(p.activity, addDays(p.today, -6), p.today)
  const prior = averageBetween(p.activity, addDays(p.today, -13), addDays(p.today, -7))
  const delta = week != null && prior != null ? week - prior : null
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <Stat label="Overall" value={overall != null ? fmtScore(overall) : '–'} sub={`${all.length} graded`} />
      <Stat
        label="Last 7 days"
        value={week != null ? fmtScore(week) : '–'}
        sub={
          delta == null ? (
            'vs the week before'
          ) : (
            <span className={cx('inline-flex items-center gap-1', delta >= 0 ? 'text-accent-text' : 'text-danger')}>
              {delta >= 0 ? <TrendingUp aria-hidden className="size-3.5" /> : <TrendingDown aria-hidden className="size-3.5" />}
              {delta >= 0 ? '+' : ''}
              {fmtScore(delta)} vs week before
            </span>
          )
        }
      />
    </div>
  )
}

function WeakSpots({ p }: { p: Progress }) {
  const weak = p.stats.filter((t) => t.scores.length).sort((a, b) => a.avg! - b.avg! || b.weight - a.weight).slice(0, 5)
  const untried = p.stats.filter((t) => !t.answered).sort((a, b) => b.weight - a.weight).slice(0, 3)
  if (!weak.length && !untried.length) return null
  return (
    <section aria-labelledby="weak" className="mt-8">
      <h2 id="weak" className="font-semibold">Weak spots</h2>
      <p className="mt-1 text-sm text-muted">Your lowest-scoring topics. The question writer leans on these, plus heavy topics you haven't tried.</p>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
        {weak.map((t) => (
          <li key={t.topic_id}>
            <Link to={t.lastItem ? `/questions/${t.lastItem.id}` : '/plan'} className="flex items-center gap-3 px-4 py-3 hover:bg-raised sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                  <LevelPill level={t.level} />
                  <span>
                    {t.scores.length} graded · last {fmtScore(t.scores[t.scores.length - 1])}
                  </span>
                </div>
              </div>
              <ScorePill score={t.avg!} suffix=" avg" />
            </Link>
          </li>
        ))}
        {untried.map((t) => (
          <li key={t.topic_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.name}</p>
              <p className="text-xs text-muted">{t.asked ? 'Asked, not answered yet' : 'Not tried yet'} · {(t.weight * 100).toFixed(1)}% of your plan</p>
            </div>
            <span className="text-xs font-medium text-faint">Not tried</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- Days list with filters ----

function Days({ p }: { p: Progress }) {
  const [params, setParams] = useSearchParams()
  const topic = params.get('topic') ?? ''
  const format = params.get('format') ?? ''
  const result = params.get('result') ?? ''
  const q = params.get('q') ?? ''

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(
    () =>
      p.items.filter(
        (h) =>
          (!topic || String(h.topic_id) === topic) &&
          (!format || h.format === format) &&
          (!result || resultOf(h) === result) &&
          (!q || `${h.topic.name} ${h.prompt}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [p.items, topic, format, result, q],
  )
  const days = groupByDay(filtered)
  const full = new Map(groupByDay(p.items).map((d) => [d.day, d]))
  const topics = [...new Map(p.items.map((h) => [h.topic_id, h.topic.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const formats = [...new Set(p.items.map((h) => h.format))]
  const active = topic || format || result || q

  const select = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'
  return (
    <section aria-labelledby="days" className="mt-8">
      <h2 id="days" className="font-semibold">Every day</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="relative col-span-2">
          <span className="sr-only">Search questions</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input type="search" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search questions" className={cx(select, 'pl-9')} />
        </label>
        <label>
          <span className="sr-only">Topic</span>
          <select value={topic} onChange={(e) => set('topic', e.target.value)} className={select}>
            <option value="">All topics</option>
            {topics.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Format</span>
          <select value={format} onChange={(e) => set('format', e.target.value)} className={select}>
            <option value="">All formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>{FORMAT_LABEL[f as QuestionFormat]}</option>
            ))}
          </select>
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className="sr-only">Result</span>
          <select value={result} onChange={(e) => set('result', e.target.value)} className={select}>
            <option value="">Any result</option>
            {(Object.keys(RESULTS) as Result[]).map((r) => (
              <option key={r} value={r}>{RESULTS[r]}</option>
            ))}
          </select>
        </label>
      </div>
      {active && (
        <p className="mt-3 text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? 'question matches' : 'questions match'}.{' '}
          <button type="button" className="font-medium text-accent-text hover:underline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </button>
        </p>
      )}
      {days.length ? (
        <ol className="mt-4 space-y-3">
          {days.map((d, i) => (
            <DayRow key={d.day} d={d} full={full.get(d.day)!} open={i === 0 || !!active} />
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-center text-sm text-muted">Nothing matches those filters.</p>
      )}
    </section>
  )
}

function DayRow({ d, full, open }: { d: DaySummary; full: DaySummary; open: boolean }) {
  const topics = [...new Set(full.items.map((h) => h.topic.name))]
  return (
    <li>
      <details open={open} className="group rounded-2xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{formatDate(d.day, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            <p className="text-sm text-muted">
              {full.answered} of {full.items.length} answered
            </p>
            <p className="mt-1 hidden truncate text-xs text-faint sm:block">{topics.join(' · ')}</p>
          </div>
          {full.avg != null && <ScorePill score={full.avg} suffix=" avg" />}
          <ChevronDown aria-hidden className="size-5 shrink-0 text-faint transition-transform group-open:rotate-180" />
        </summary>
        <ul className="divide-y divide-line border-t border-line">
          {d.items.map((h) => (
            <li key={h.id}>
              <HistoryRow h={h} />
            </li>
          ))}
        </ul>
        <Link to={`/history/${d.day}`} className="block border-t border-line px-4 py-3 text-sm font-medium text-accent-text hover:bg-raised sm:px-5">
          Open this day
        </Link>
      </details>
    </li>
  )
}

function HistoryRow({ h }: { h: HistoryItemView }) {
  return (
    <Link to={`/questions/${h.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{h.topic.name}</p>
        <p className="truncate text-sm text-muted">{plainPreview(h.prompt)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{FORMAT_LABEL[h.format]}</span>
          <Difficulty value={h.difficulty} />
          <span>{h.minutes} min</span>
        </div>
      </div>
      {h.score != null ? (
        <ScorePill score={h.score} />
      ) : h.answer_id ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-warn-text">
          <CircleDashed aria-hidden className="size-3.5" /> Waiting
        </span>
      ) : (
        <span className="text-xs font-medium text-faint">Unanswered</span>
      )}
    </Link>
  )
}

function HistorySkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
      <SkeletonList rows={3} className="mt-8" />
    </div>
  )
}
