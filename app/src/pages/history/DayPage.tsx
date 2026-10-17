import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Snowflake } from 'lucide-react'
import { useProgress } from '../../lib/useProgress'
import { formatDate } from '../../lib/format'
import { addDays, fmtScore, isReview, practiceMinutes } from '../../lib/progress'
import { EmptyState, ErrorState, Skeleton, SkeletonList } from '../../components/ui'
import { ScorePill } from '../../components/habit'
import { QuestionCard } from '../../components/QuestionCard'

/** One day's questions, opened from the calendar or the days list. */
export default function DayPage() {
  const { date = '' } = useParams()
  const { data: p, error, loading, reload } = useProgress([date])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading || !p) return <DaySkeleton />

  const items = p.items.filter((h) => h.set_date === date)
  const answered = items.filter((h) => h.answer_id).length
  const scores = items.flatMap((h) => (h.score == null ? [] : [h.score]))
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const minutes = Math.round(items.reduce((s, h) => s + practiceMinutes(h), 0))
  const stats = new Map(p.stats.map((t) => [t.topic_id, t]))
  const days = [...new Set(p.items.map((h) => h.set_date))].sort()
  const prev = days.filter((d) => d < date).pop()
  const next = days.find((d) => d > date)
  const title = date === p.today ? 'Today' : date === addDays(p.today, -1) ? 'Yesterday' : formatDate(date, { weekday: 'long' })

  return (
    <article>
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> History
      </Link>
      <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent-text">{formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {items.length > 0 && (
            <p className="mt-1 text-muted">
              {answered} of {items.length} answered · {minutes} min practiced
              {avg != null && ` · average ${fmtScore(avg)}/5`}
            </p>
          )}
        </div>
        {avg != null && <ScorePill score={avg} suffix=" avg" className="text-sm" />}
      </header>

      {p.streak.frozen.has(date) && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-frost/40 px-3 py-2 text-sm text-frost">
          <Snowflake aria-hidden className="size-4" /> A streak freeze covered this day, so your streak kept going.
        </p>
      )}

      {items.length ? (
        <ol className="mt-8 space-y-3">
          {items.map((h, i) => (
            <li key={h.id}>
              <QuestionCard h={h} n={i + 1} stat={stats.get(h.topic_id)} review={isReview(p.items, h)} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-8">
          <EmptyState title="No questions on this day">Pick a day with practice from the calendar on History.</EmptyState>
        </div>
      )}

      <nav aria-label="Other days" className="mt-8 grid grid-cols-2 gap-3">
        {prev ? (
          <Link to={`/history/${prev}`} className="rounded-2xl border border-line p-4 hover:bg-raised">
            <span className="text-xs text-muted">Earlier</span>
            <span className="mt-1 block font-medium">{formatDate(prev, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/history/${next}`} className="rounded-2xl border border-line p-4 text-right hover:bg-raised">
            <span className="text-xs text-muted">Later</span>
            <span className="mt-1 block font-medium">{formatDate(next, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </Link>
        )}
      </nav>
    </article>
  )
}

function DaySkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-6 h-8 w-56" />
      <SkeletonList rows={3} className="mt-8" />
    </div>
  )
}
