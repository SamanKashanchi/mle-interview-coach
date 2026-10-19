import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Lightbulb, RotateCcw, TrendingUp } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { buildProgress } from '../../lib/useProgress'
import { CATEGORY_LABEL, formatDate } from '../../lib/format'
import { isReview, LEVEL_LABEL, LEVELS, levelFor, scoresByTopic } from '../../lib/progress'
import type { HistoryItemView } from '../../lib/types'
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { LevelPill, OnceToasts } from '../../components/habit'
import { QuestionMeta } from './meta'
import { Markdown } from '../../components/Markdown'
import { AnswerPanel } from './AnswerPanel'
import type { CodeSpec, QuestionView } from '../../lib/types'

// The editor, Python and Postgres only download on coding questions.
const CodeWorkspace = lazy(() => import('./CodeWorkspace'))

export default function QuestionPage() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([db.getQuestion(id), db.getHistory(), db.getFocusTopics(), db.getProfile()]),
    [id],
  )

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading || !data) return <QuestionSkeleton />

  const [q, items, focus, profile] = data
  if (!q) {
    return (
      <EmptyState title="Question not found" action={<BackToToday />}>
        It may have been replaced by a newer set.
      </EmptyState>
    )
  }

  const p = buildProgress(items, focus, profile)
  const set = items.filter((h) => h.set_date === q.set_date)
  const index = set.findIndex((x) => x.id === q.id)
  const fromToday = q.set_date === p.today
  const stat = p.stats.find((t) => t.topic_id === q.topic_id)
  const me = items.find((h) => h.id === q.id)
  const review = me ? isReview(items, me) : false
  const before = levelFor(scoresByTopic(items, { excludeId: q.id }).get(q.topic_id) ?? [])
  const after = stat?.level ?? before
  const levelledUp = me?.score != null && LEVELS.indexOf(after) > LEVELS.indexOf(before)
  const back = fromToday ? (
    <BackToToday />
  ) : (
    <Link to={`/history/${q.set_date}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> From {formatDate(q.set_date, { weekday: 'short', month: 'short', day: 'numeric' })}
    </Link>
  )
  const header = (
    <header>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-accent-text">
        {index >= 0 && (
          <span>
            Question {index + 1} of {set.length}
          </span>
        )}
        {review && (
          <Badge tone="accent">
            <RotateCcw aria-hidden className="size-3" /> Review
          </Badge>
        )}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{q.topic.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {CATEGORY_LABEL[q.topic.category]}
        {q.topic.description && ` · ${q.topic.description}`}
      </p>
      {stat && <LevelPill level={stat.level} className="mt-2" />}
      <QuestionMeta q={q} className="mt-4" />
      {q.reason && (
        <p className="mt-4 flex gap-2 text-sm text-muted">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
          <span>
            <span className="font-medium text-ink/80">Why this question: </span>
            {q.reason}
          </span>
        </p>
      )}
    </header>
  )
  const nav = index >= 0 && <PrevNext set={set} index={index} fromToday={fromToday} />
  const toast = levelledUp && (
    <OnceToasts
      items={[
        {
          id: `level:${q.id}`,
          icon: <TrendingUp className="size-5" />,
          message: (
            <>
              <span className="font-semibold">{q.topic.name}:</span> {LEVEL_LABEL[before]} → {LEVEL_LABEL[after]}
            </>
          ),
        },
      ]}
    />
  )

  if (q.code) {
    // data-wide lets the layout drop its reading width for the side-by-side editor.
    return (
      <article data-wide>
        {back}
        <Suspense fallback={<Skeleton className="mt-4 h-[32rem] w-full rounded-2xl" />}>
          <CodeWorkspace
            q={q as QuestionView & { code: CodeSpec }}
            header={
              <>
                {header}
                <Markdown className="mt-6 border-t border-line pt-6 leading-relaxed">{q.prompt}</Markdown>
              </>
            }
            footer={nav}
          />
        </Suspense>
        {toast}
      </article>
    )
  }

  return (
    <article>
      {back}
      <div className="mt-6">{header}</div>
      <Card className="mt-8">
        <Markdown className="text-[17px] leading-relaxed">{q.prompt}</Markdown>
      </Card>
      <AnswerPanel key={q.id} q={q} />
      {nav}
      {toast}
    </article>
  )
}

function BackToToday() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> Today
    </Link>
  )
}

function PrevNext({ set, index, fromToday }: { set: HistoryItemView[]; index: number; fromToday: boolean }) {
  const prev = set[index - 1]
  const next = set[index + 1]
  return (
    <nav aria-label="Other questions in this set" className="mt-8 grid grid-cols-2 gap-3">
      {prev ? (
        <Link to={`/questions/${prev.id}`} className="rounded-2xl border border-line p-4 hover:bg-raised">
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ArrowLeft aria-hidden className="size-3.5" /> Previous
          </span>
          <span className="mt-1 block truncate font-medium">{prev.topic.name}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={`/questions/${next.id}`} className="rounded-2xl border border-line p-4 text-right hover:bg-raised">
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            Next <ArrowRight aria-hidden className="size-3.5" />
          </span>
          <span className="mt-1 block truncate font-medium">{next.topic.name}</span>
        </Link>
      ) : (
        <Link to={fromToday ? '/' : `/history/${set[0].set_date}`} className="rounded-2xl border border-line p-4 text-right hover:bg-raised">
          <span className="text-xs text-muted">That's the day</span>
          <span className="mt-1 block font-medium">{fromToday ? 'Back to Today' : 'Back to that day'}</span>
        </Link>
      )}
    </nav>
  )
}

function QuestionSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-6 h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-48" />
      <Skeleton className="mt-8 h-48 w-full rounded-2xl" />
    </div>
  )
}
