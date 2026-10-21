import { Link } from 'react-router-dom'
import { Hourglass, PartyPopper, Sparkles, Trophy } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { useProgress, type Progress } from '../../lib/useProgress'
import { daysUntil, formatDate, greeting } from '../../lib/format'
import { addDays, averageBetween, dueReviews, fmtScore, isReview, practiceMinutes, setsOf } from '../../lib/progress'
import type { HistoryItemView, Profile, TargetView } from '../../lib/types'
import { Card, EmptyState, ErrorState, Skeleton, SkeletonList } from '../../components/ui'
import { GoalRing } from '../../components/habit'
import { QuestionCard } from '../../components/QuestionCard'
import { GenerateQuestions } from '../../components/GenerateQuestions'

export default function Today() {
  const { data, error, loading, reload } = useProgress()

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading || !data) return <TodaySkeleton />

  const p = data
  const todays = p.items.filter((h) => h.set_date === p.today)
  return (
    <>
      <Header profile={p.profile} />
      <GoalStrip p={p} todays={todays} />
      {(p.items.length > 0 || p.focus.length > 0) && <GenerateQuestions focus={p.focus} onDone={reload} />}
      {todays.length ? (
        <>
          <SessionComplete p={p} todays={todays} />
          <TodaysSets p={p} todays={todays} />
        </>
      ) : p.items.length ? (
        <NoSetYet p={p} />
      ) : (
        <NoQuestions />
      )}
    </>
  )
}

function Header({ profile }: { profile: Profile | null }) {
  const first = profile?.name?.split(' ')[0]
  const days = profile?.ready_by ? daysUntil(profile.ready_by) : null
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting()}
        {first ? `, ${first}` : ''}.
      </h1>
      {days != null && (
        <p className="mt-2 inline-flex items-center gap-2 text-muted">
          <Hourglass aria-hidden className="size-4 text-accent" />
          {days > 0 ? (
            <span>
              <span className="font-semibold text-ink">{days}</span> {days === 1 ? 'day' : 'days'} to go, ready by {formatDate(profile!.ready_by!)}
            </span>
          ) : days === 0 ? (
            <span>Your ready-by date is today. You've got this.</span>
          ) : (
            <span>Your ready-by date has passed. Set a new one in Profile.</span>
          )}
        </p>
      )}
    </header>
  )
}

/** Today's practice minutes against the daily goal. */
function GoalStrip({ p, todays }: { p: Progress; todays: HistoryItemView[] }) {
  const goal = p.profile?.minutes_per_day ?? 60
  const minutes = p.activity.get(p.today)?.minutes ?? 0
  return (
    <Link
      to={todays.length ? `/history/${p.today}` : '/history'}
      aria-label="Your progress today"
      className="mb-6 flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 hover:bg-raised"
    >
      <GoalRing minutes={minutes} goal={goal} size={64} />
      <div>
        <p className="text-sm font-semibold">{minutes >= goal ? 'Goal met' : 'Daily goal'}</p>
        <p className="text-xs text-muted">
          {Math.round(minutes)} of {goal} min practiced today
        </p>
      </div>
    </Link>
  )
}

/** Duolingo's lesson-complete moment: shows once everything today is answered. */
function SessionComplete({ p, todays }: { p: Progress; todays: HistoryItemView[] }) {
  if (todays.some((h) => !h.answer_id)) return null
  const minutes = Math.round(todays.reduce((s, h) => s + practiceMinutes(h), 0))
  const topics = [...new Set(todays.map((h) => h.topic.name))]
  const graded = todays.filter((h) => h.score != null)
  const allGraded = graded.length === todays.length

  if (!allGraded) {
    return (
      <Card className="mb-6 border-accent/40">
        <div className="flex gap-4">
          <span aria-hidden className="animate-pop flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <PartyPopper className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Set complete</h2>
            <p className="mt-1 text-sm text-muted">
              {minutes} min · {topics.join(', ')}
            </p>
            <p className="mt-2 text-sm text-muted">Your grades land here as soon as the grader finishes.</p>
          </div>
        </div>
      </Card>
    )
  }

  const avg = graded.reduce((s, h) => s + h.score!, 0) / graded.length
  const week = averageBetween(p.activity, addDays(p.today, -7), addDays(p.today, -1))
  const best = [...graded].sort((a, b) => b.score! - a.score!)[0]
  const worst = [...graded].sort((a, b) => a.score! - b.score!)[0]
  const delta = week != null ? avg - week : null
  return (
    <Card className="mb-6 border-accent/40">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Trophy className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Today's results: avg {fmtScore(avg)}/5</h2>
          <p className="text-sm text-muted">
            {delta != null ? `${delta >= 0 ? '+' : ''}${fmtScore(delta)} vs your 7-day average` : 'Your first graded day'} · {minutes} min
          </p>
        </div>
      </div>
      {best.id !== worst.id && (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Link to={`/questions/${best.id}`} className="rounded-xl bg-raised px-3 py-2 hover:text-accent-text">
            Best: {best.topic.name} <span className="font-semibold">{fmtScore(best.score!)}</span>
          </Link>
          <Link to={`/questions/${worst.id}`} className="rounded-xl bg-raised px-3 py-2 hover:text-accent-text">
            To revisit: {worst.topic.name} <span className="font-semibold">{fmtScore(worst.score!)}</span>
          </Link>
        </div>
      )}
    </Card>
  )
}

function TodaysSets({ p, todays }: { p: Progress; todays: HistoryItemView[] }) {
  const answered = todays.filter((h) => h.answer_id).length
  const scores = todays.flatMap((h) => (h.score == null ? [] : [h.score]))
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const total = todays.reduce((s, h) => s + h.minutes, 0)
  const sets = setsOf(todays)
  const stats = new Map(p.stats.map((t) => [t.topic_id, t]))
  let n = 0
  return (
    <section aria-labelledby="set-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="set-title" className="text-lg font-semibold">
            Today's questions
          </h2>
          <p className="text-sm text-muted">
            {answered === todays.length ? 'All answered. Nice work.' : `${answered} of ${todays.length} answered`}
            {avg != null && ` · today's average ${fmtScore(avg)}/5`}
          </p>
        </div>
        <p className="text-sm text-muted">{total} min of questions</p>
      </div>
      <div className="space-y-6">
        {sets.map((set, si) => (
          <div key={set[0].created_at}>
            {sets.length > 1 && (
              <p className="mb-2 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-faint">
                Set {si + 1} · {new Date(set[0].created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                <span className="h-px flex-1 bg-line" />
              </p>
            )}
            <ol className="space-y-3">
              {set.map((h) => (
                <li key={h.id}>
                  <QuestionCard h={h} n={++n} stat={stats.get(h.topic_id)} review={isReview(p.items, h)} />
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

function NoSetYet({ p }: { p: Progress }) {
  const lastDay = p.items[p.items.length - 1].set_date
  const leftover = p.items.filter((h) => h.set_date === lastDay && !h.answer_id)
  const due = dueReviews(p.items, p.today)
  const names = new Map(p.stats.map((t) => [t.topic_id, t.name]))
  return (
    <EmptyState icon={<Sparkles className="size-6" />} title="No new set yet today">
      <p>The worker on the Mac mini writes each day's set from 5 AM. If it's past that, the Mac may be off or asleep. You can also generate questions now.</p>
      {due.length > 0 && <p className="mt-3">Due for review: {due.map((d) => names.get(d.topic_id) ?? 'a topic').join(', ')}.</p>}
      <p className="mt-3">
        <Link to={`/history/${lastDay}`} className="font-medium text-accent-text underline-offset-2 hover:underline">
          {formatDate(lastDay, { weekday: 'long', month: 'short', day: 'numeric' })}
        </Link>
        {leftover.length > 0 && ` has ${leftover.length} unanswered ${leftover.length === 1 ? 'question' : 'questions'} left.`}
      </p>
    </EmptyState>
  )
}

function NoQuestions() {
  const { data: targets } = useAsync(() => db.listTargets(), [])
  const pending = (targets ?? []).filter((t: TargetView) => t.research?.status !== 'done')
  return (
    <EmptyState icon={<Sparkles className="size-6" />} title="Your first questions are on the way">
      <p>
        {pending.length
          ? `Next, Claude researches how ${listNames(pending.map((t) => t.company))} interview${pending.length === 1 ? 's' : ''}, builds your plan, and writes a daily set sized to your time.`
          : 'Claude builds your plan from your research, then writes a daily set sized to your time.'}
      </p>
      <p className="mt-3">Answer your first question to start your history.</p>
      <p className="mt-3">
        <Link to="/targets" className="font-medium text-accent-text underline-offset-2 hover:underline">
          See your targets
        </Link>
      </p>
    </EmptyState>
  )
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? 'your companies'
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function TodaySkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-48" />
      <Skeleton className="mt-6 h-28 w-full rounded-2xl" />
      <SkeletonList rows={3} className="mt-8" />
    </div>
  )
}

