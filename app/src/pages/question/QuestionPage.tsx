import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Lock } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { CATEGORY_LABEL } from '../../lib/format'
import type { QuestionView } from '../../lib/types'
import { Card, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { cx } from '../../lib/cx'
import { QuestionMeta } from './meta'

export default function QuestionPage() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useAsync(() => Promise.all([db.getQuestion(id), db.getLatestQuestions()]), [id])

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading || !data) return <QuestionSkeleton />

  const [q, set] = data
  if (!q) {
    return (
      <EmptyState title="Question not found" action={<BackToToday />}>
        It may have been replaced by a newer set.
      </EmptyState>
    )
  }

  const index = set.findIndex((x) => x.id === q.id)
  return (
    <article>
      <BackToToday />
      <header className="mt-6">
        {index >= 0 && (
          <p className="text-sm font-medium text-accent-text">
            Question {index + 1} of {set.length}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{q.topic.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {CATEGORY_LABEL[q.topic.category]}
          {q.topic.description && ` · ${q.topic.description}`}
        </p>
        <QuestionMeta q={q} className="mt-4" />
      </header>

      <Card className="mt-8">
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{q.prompt}</p>
      </Card>

      <Rubric items={q.rubric} />
      <AnswerPlaceholder />
      {index >= 0 && <PrevNext set={set} index={index} />}
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

function Rubric({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left font-medium sm:px-6"
      >
        {open ? 'What a strong answer covers' : 'Show what a strong answer covers'}
        <ChevronDown aria-hidden className={cx('size-5 shrink-0 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul id={id} className="space-y-3 border-t border-line px-5 py-5 sm:px-6">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {!open && <p className="sr-only">Try answering first, then compare.</p>}
    </section>
  )
}

function AnswerPlaceholder() {
  const id = useId()
  return (
    <section className="mt-4 rounded-2xl border border-dashed border-line p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-medium">
          Your answer
        </label>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Lock aria-hidden className="size-3.5" /> Coming next
        </span>
      </div>
      <textarea
        id={id}
        disabled
        rows={4}
        aria-describedby={`${id}-note`}
        placeholder="Write or talk through your answer here."
        className="mt-3 w-full cursor-not-allowed resize-none rounded-lg border border-line bg-raised/60 px-3 py-2.5 placeholder:text-faint"
      />
      <p id={`${id}-note`} className="mt-2 text-sm text-muted">
        Answering and grading are coming next. For now, answer out loud or on paper, then check it against the list above.
      </p>
    </section>
  )
}

function PrevNext({ set, index }: { set: QuestionView[]; index: number }) {
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
        <Link to="/" className="rounded-2xl border border-line p-4 text-right hover:bg-raised">
          <span className="text-xs text-muted">That's the set</span>
          <span className="mt-1 block font-medium">Back to Today</span>
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
