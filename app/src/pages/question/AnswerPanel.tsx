import { useEffect, useId, useState, type FormEvent } from 'react'
import { clock, useElapsed } from '../../lib/useElapsed'
import { usePollWhile } from '../../lib/usePollWhile'
import { Check, ChevronDown, CircleDashed, Clock, Minus, RotateCcw, Send, X } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { formatDate, scoreLabel } from '../../lib/format'
import type { AnswerView, Grade, QuestionView, Verdict } from '../../lib/types'
import { Button, Card, ErrorState, InlineError, Skeleton } from '../../components/ui'
import { cx } from '../../lib/cx'

const CODE_FORMATS = new Set(['coding', 'ml_coding'])

/** Everything below the prompt: write an answer, wait for the grade, read the feedback. */
export function AnswerPanel({ q }: { q: QuestionView }) {
  const { data, error, loading, reload } = useAsync(() => db.getAnswers(q.id), [q.id])
  const [composing, setComposing] = useState(false)
  usePollWhile(data?.[0]?.status === 'pending', reload)

  if (error) return <ErrorState message={error} onRetry={reload} className="mt-4" />
  if (loading && !data) return <Skeleton className="mt-4 h-48 w-full rounded-2xl" />

  const attempts = data ?? []
  const latest = attempts[0]
  const code = CODE_FORMATS.has(q.format)

  if (!latest || composing) {
    return (
      <>
        <Composer
          q={q}
          code={code}
          attempt={attempts.length + 1}
          onCancel={latest ? () => setComposing(false) : undefined}
          onSubmitted={() => {
            setComposing(false)
            reload()
          }}
        />
        <Rubric items={q.rubric} />
      </>
    )
  }

  return (
    <>
      {latest.grade ? <Feedback grade={latest.grade} code={code} /> : <Pending />}
      <Details summary="Your answer" meta={answerMeta(latest)}>
        <pre className={cx('whitespace-pre-wrap break-words text-sm', code ? 'font-mono' : 'font-sans')}>{latest.body}</pre>
      </Details>
      {!latest.grade && <Rubric items={q.rubric} />}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setComposing(true)}>
          <RotateCcw aria-hidden className="size-4" /> Try again
        </Button>
        {attempts.length > 1 && <EarlierAttempts attempts={attempts.slice(1)} />}
      </div>
    </>
  )
}

// ---- Writing an answer ----

const draftKey = (id: string) => `draft:${id}`

function readDraft(id: string) {
  try {
    return localStorage.getItem(draftKey(id)) ?? ''
  } catch {
    return ''
  }
}

function writeDraft(id: string, text: string) {
  try {
    if (text) localStorage.setItem(draftKey(id), text)
    else localStorage.removeItem(draftKey(id))
  } catch {
    // A lost draft is fine; the answer itself is saved on submit.
  }
}

function Composer({
  q,
  code,
  attempt,
  onCancel,
  onSubmitted,
}: {
  q: QuestionView
  code: boolean
  attempt: number
  onCancel?: () => void
  onSubmitted: () => void
}) {
  const id = useId()
  const [body, setBody] = useState(() => readDraft(q.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const elapsed = useElapsed()

  useEffect(() => writeDraft(q.id, body), [q.id, body])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return setError('Write an answer first.')
    setBusy(true)
    setError(null)
    try {
      await db.submitAnswer(q.id, body, elapsed)
      writeDraft(q.id, '')
      onSubmitted()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const over = elapsed > q.minutes * 60
  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={id} className="font-medium">
          Your answer{attempt > 1 && <span className="font-normal text-muted"> · attempt {attempt}</span>}
        </label>
        <span className={cx('inline-flex items-center gap-1.5 text-sm tabular-nums', over ? 'text-warn-text' : 'text-muted')} aria-live="off">
          <Clock aria-hidden className="size-4" />
          {clock(elapsed)} <span className="text-faint">of {q.minutes}:00</span>
        </span>
      </div>
      <textarea
        id={id}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={code ? 14 : 10}
        spellCheck={!code}
        placeholder={
          code
            ? 'Write your code. Add a line or two on your approach and its complexity.'
            : 'Answer as you would out loud: structure first, then the details and trade-offs.'
        }
        className={cx(
          'mt-3 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
          code && 'font-mono text-sm',
        )}
      />
      {error && <div className="mt-2"><InlineError>{error}</InlineError></div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Drafts save on this device as you type.</p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" busy={busy}>
            <Send aria-hidden className="size-4" /> Submit for grading
          </Button>
        </div>
      </div>
    </form>
  )
}

// ---- After submitting ----

export function Pending() {
  return (
    <Card className="mt-4">
      <div className="flex gap-4">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn-text">
          <CircleDashed className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">Submitted. Waiting for a grade.</h2>
          <p className="mt-1 text-muted">
            The grader usually picks it up within a minute or two. Your score, feedback on each point and a model answer will
            show up here by themselves.
          </p>
        </div>
      </div>
    </Card>
  )
}

const VERDICT: Record<Verdict, { label: string; icon: typeof Check; className: string }> = {
  met: { label: 'Covered', icon: Check, className: 'bg-accent-soft text-accent-text' },
  partial: { label: 'Partly covered', icon: Minus, className: 'bg-warn-soft text-warn-text' },
  missed: { label: 'Missed', icon: X, className: 'bg-danger-soft text-danger' },
}

export function Feedback({ grade, code }: { grade: Grade; code: boolean }) {
  const score = Number(grade.score)
  const counts = grade.rubric_scores.reduce((c, r) => ({ ...c, [r.verdict]: (c[r.verdict] ?? 0) + 1 }), {} as Partial<Record<Verdict, number>>)
  return (
    <section aria-labelledby="feedback" className="mt-4 rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-5 border-b border-line p-5 sm:p-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tabular-nums">{score}</span>
          <span className="text-muted">/ 5</span>
        </div>
        <div>
          <h2 id="feedback" className="font-semibold">{scoreLabel(score)}</h2>
          <p className="text-sm text-muted">
            {[counts.met && `${counts.met} covered`, counts.partial && `${counts.partial} partly`, counts.missed && `${counts.missed} missed`]
              .filter(Boolean)
              .join(' · ')}
            {' · '}graded {formatDate(grade.graded_at, { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {grade.rubric_scores.map((r) => {
          const v = VERDICT[r.verdict]
          return (
            <li key={r.point} className="flex gap-3 px-5 py-4 sm:px-6">
              <span className={cx('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', v.className)} title={v.label}>
                <v.icon aria-hidden className="size-3.5" />
                <span className="sr-only">{v.label}:</span>
              </span>
              <div className="min-w-0">
                <p className="font-medium">{r.point}</p>
                {r.note && <p className="mt-0.5 text-sm text-muted">{r.note}</p>}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-6 border-t border-line p-5 sm:grid-cols-2 sm:p-6">
        {grade.strengths.length > 0 && <List title="What worked" items={grade.strengths} />}
        {grade.improvements.length > 0 && <List title="Do next time" items={grade.improvements} numbered />}
      </div>

      {grade.model_answer && (
        <div className="border-t border-line">
          <Details summary="Model answer" bare>
            <pre className={cx('whitespace-pre-wrap break-words text-sm', code ? 'font-mono' : 'font-sans')}>{grade.model_answer}</pre>
          </Details>
        </div>
      )}
    </section>
  )
}

function List({ title, items, numbered }: { title: string; items: string[]; numbered?: boolean }) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <Tag className="mt-2 space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={item} className="flex gap-2.5">
            <span aria-hidden className="w-4 shrink-0 text-faint">{numbered ? `${i + 1}.` : '•'}</span>
            <span>{item}</span>
          </li>
        ))}
      </Tag>
    </div>
  )
}

function EarlierAttempts({ attempts }: { attempts: AnswerView[] }) {
  return (
    <p className="text-sm text-muted">
      Earlier:{' '}
      {attempts
        .map((a) => (a.grade ? `${Number(a.grade.score)}/5` : 'not graded'))
        .join(', ')}
    </p>
  )
}

function answerMeta(a: AnswerView) {
  const parts = [formatDate(a.created_at, { month: 'short', day: 'numeric' })]
  if (a.seconds_spent != null) parts.push(`${Math.max(1, Math.round(a.seconds_spent / 60))} min`)
  return parts.join(' · ')
}

// ---- Shared bits ----

export function Details({ summary, meta, bare, children }: { summary: string; meta?: string; bare?: boolean; children: React.ReactNode }) {
  return (
    <details className={cx('group', !bare && 'mt-4 rounded-2xl border border-line bg-surface')}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-medium sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          {summary}
          {meta && <span className="ml-2 text-sm font-normal text-muted">{meta}</span>}
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-5 py-4 sm:px-6">{children}</div>
    </details>
  )
}

export function Rubric({ items }: { items: string[] }) {
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
    </section>
  )
}
