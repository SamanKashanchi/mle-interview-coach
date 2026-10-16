import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, CircleDashed, Hourglass, Sparkles } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { daysUntil, formatDate, greeting, isToday } from '../../lib/format'
import type { AttemptSummary, Profile, QuestionView, TargetView } from '../../lib/types'
import { Badge, EmptyState, ErrorState, Skeleton, SkeletonList } from '../../components/ui'
import { QuestionMeta } from '../question/meta'

export default function Today() {
  const { data, error, loading, reload } = useAsync(
    async () => {
      const [profile, questions, targets] = await Promise.all([db.getProfile(), db.getLatestQuestions(), db.listTargets()])
      const attempts = await db.getAttemptSummaries(questions.map((q) => q.id))
      return [profile, questions, targets, attempts] as const
    },
    [],
  )

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading || !data) return <TodaySkeleton />

  const [profile, questions, targets, attempts] = data
  return (
    <>
      <Header profile={profile} />
      {questions.length ? <QuestionSet questions={questions} attempts={attempts} goal={profile?.minutes_per_day ?? null} /> : <NoQuestions targets={targets} />}
    </>
  )
}

function Header({ profile }: { profile: Profile | null }) {
  const first = profile?.name?.split(' ')[0]
  const days = profile?.ready_by ? daysUntil(profile.ready_by) : null
  return (
    <header className="mb-10">
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

function QuestionSet({ questions, attempts, goal }: { questions: QuestionView[]; attempts: readonly AttemptSummary[]; goal: number | null }) {
  const done = questions.filter((q) => attempts.some((a) => a.question_id === q.id)).length
  const total = questions.reduce((s, q) => s + q.minutes, 0)
  const createdAt = questions[0].created_at
  const fresh = isToday(createdAt)
  return (
    <section aria-labelledby="set-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="set-title" className="text-lg font-semibold">
            {fresh ? "Today's questions" : 'Your latest questions'}
          </h2>
          <p className="text-sm text-muted">
            {done === questions.length ? 'All answered. Nice work.' : `${done} of ${questions.length} answered`}
          </p>
          {!fresh && <p className="text-sm text-muted">Written {formatDate(createdAt, { month: 'short', day: 'numeric' })}. A new set comes with your next update.</p>}
        </div>
        <MinutesMeter total={total} goal={goal} />
      </div>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={q.id}>
            <Link
              to={`/questions/${q.id}`}
              className="group block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-semibold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{q.topic.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{q.prompt}</p>
                  <QuestionMeta q={q} className="mt-4" />
                  <AttemptBadge attempt={attempts.find((a) => a.question_id === q.id)} />
                </div>
                <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function AttemptBadge({ attempt }: { attempt?: AttemptSummary }) {
  if (!attempt) return null
  return (
    <div className="mt-3">
      {attempt.score != null ? (
        <Badge tone="accent">
          <CheckCircle2 aria-hidden className="size-3.5" /> Graded {attempt.score}/5
        </Badge>
      ) : (
        <Badge tone="warn">
          <CircleDashed aria-hidden className="size-3.5" /> Answered, waiting for a grade
        </Badge>
      )}
    </div>
  )
}

function MinutesMeter({ total, goal }: { total: number; goal: number | null }) {
  if (!goal) return <p className="text-sm text-muted">{total} min total</p>
  const ratio = Math.min(total / goal, 1)
  return (
    <div className="w-40 text-right">
      <p className="text-sm text-muted">
        <span className="font-semibold text-ink">{total}</span> of {goal} min
      </p>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label="Minutes in this set against your daily goal"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={total}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

function NoQuestions({ targets }: { targets: TargetView[] }) {
  const pending = targets.filter((t) => t.research?.status !== 'done')
  return (
    <EmptyState icon={<Sparkles className="size-6" />} title="Your first questions are on the way">
      <p>
        {pending.length
          ? `Next, Claude researches how ${listNames(pending.map((t) => t.company))} interview${pending.length === 1 ? 's' : ''}, builds your plan, and writes a daily set sized to your time.`
          : 'Your research is in. Claude builds your plan from it next, then writes a daily set sized to your time.'}
      </p>
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
      <SkeletonList rows={3} className="mt-12" />
    </div>
  )
}
