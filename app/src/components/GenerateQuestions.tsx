// "Generate questions" on Today: pick kinds, topics and how many, and the Mac mini worker writes
// them (worker/prompts/requests.md). Shows the request's progress and reloads Today when it's done.

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Loader2, Minus, Plus, Sparkles, X } from 'lucide-react'
import { db } from '../lib/db'
import { useAsync } from '../lib/useAsync'
import { FORMAT_LABEL } from '../lib/format'
import type { Category, FocusTopicView, QuestionFormat, QuestionRequest } from '../lib/types'
import { Button, InlineError } from './ui'
import { cx } from '../lib/cx'

const FORMATS = Object.keys(FORMAT_LABEL) as QuestionFormat[]
// Same mapping the generator uses (agents/questions/README.md, section 3).
const FORMAT_OF: Record<Category, QuestionFormat> = {
  coding: 'coding',
  ml_coding: 'ml_coding',
  ml_fundamentals: 'ml_concept',
  deep_learning: 'ml_concept',
  ml_system_design: 'ml_system_design',
  system_design: 'system_design',
  behavioral: 'behavioral',
}
const POLL_MS = 10_000

export function GenerateQuestions({ focus, onDone }: { focus: FocusTopicView[]; onDone: () => void }) {
  const [request, setRequest] = useState<QuestionRequest | null>(null)
  const [open, setOpen] = useState(false)
  const busy = request?.status === 'pending' || request?.status === 'working'

  useEffect(() => {
    db.latestQuestionRequest().then(setRequest, () => undefined)
  }, [])

  // While the worker is on it, check back until it's done, then reload Today.
  useEffect(() => {
    if (!busy) return
    const t = setInterval(async () => {
      const next = await db.latestQuestionRequest().catch(() => null)
      if (!next || next.status === request?.status) return
      setRequest(next)
      if (next.status === 'done') onDone()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [busy, request, onDone])

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 text-sm text-muted" role="status">
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin text-accent" />
            Writing {request.count} {request.count === 1 ? 'question' : 'questions'} on the Mac mini. They'll show up here.
          </span>
        ) : request?.status === 'failed' ? (
          <span className="text-danger">Couldn't write those questions{request.note ? `: ${request.note}` : '.'}</span>
        ) : request?.status === 'done' && isRecent(request.finished_at) ? (
          `${request.count} new ${request.count === 1 ? 'question' : 'questions'} added below.`
        ) : (
          'Want more practice? Pick what to work on.'
        )}
      </p>
      <Button variant="secondary" disabled={busy} onClick={() => setOpen(true)}>
        <Sparkles aria-hidden className="size-4" /> Generate questions
      </Button>
      {open && <GenerateDialog focus={focus} onClose={() => setOpen(false)} onCreated={setRequest} />}
    </div>
  )
}

const isRecent = (at: string | null) => !!at && Date.now() - new Date(at).getTime() < 30 * 60_000

function GenerateDialog({
  focus,
  onClose,
  onCreated,
}: {
  focus: FocusTopicView[]
  onClose: () => void
  onCreated: (r: QuestionRequest) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [formats, setFormats] = useState<QuestionFormat[]>([])
  const [topicIds, setTopicIds] = useState<number[]>([])
  const [count, setCount] = useState(3)
  const [allTopics, setAllTopics] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: topics } = useAsync(() => db.listTopics(), [])

  useEffect(() => {
    const d = ref.current
    d?.showModal()
    return () => d?.close()
  }, [])

  // Your plan's topics first (by weight), or every topic; only those that fit the kinds picked.
  const planIds = new Set(focus.map((f) => f.topic_id))
  const source = allTopics || !focus.length ? (topics ?? []) : focus.map((f) => f.topic)
  const shown = source.filter((t) => !formats.length || formats.includes(FORMAT_OF[t.category]))
  const picked = topicIds.filter((id) => shown.some((t) => t.id === id))

  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await db.requestQuestions({ count, formats, topic_ids: picked }))
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="gen-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="gen-title" className="font-semibold">
            Generate questions
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink">
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-5">
          <Group label="Kind" hint={formats.length ? undefined : 'Any kind'}>
            {FORMATS.map((f) => (
              <Chip key={f} on={formats.includes(f)} onClick={() => setFormats(toggle(formats, f))}>
                {FORMAT_LABEL[f]}
              </Chip>
            ))}
          </Group>

          <Group
            label="Topics"
            hint={picked.length ? `${picked.length} picked` : 'The coach picks from your plan'}
            action={
              focus.length > 0 && (
                <button type="button" onClick={() => setAllTopics(!allTopics)} className="text-xs font-medium text-accent-text hover:underline">
                  {allTopics ? 'Only my plan' : 'Show all topics'}
                </button>
              )
            }
          >
            {!topics && !focus.length ? (
              <p className="text-sm text-muted">Loading topics…</p>
            ) : shown.length ? (
              shown.map((t) => (
                <Chip key={t.id} on={topicIds.includes(t.id)} onClick={() => setTopicIds(toggle(topicIds, t.id))}>
                  {t.name}
                  {allTopics && planIds.has(t.id) && <span className="sr-only"> (in your plan)</span>}
                </Chip>
              ))
            ) : (
              <p className="text-sm text-muted">No topics {allTopics ? '' : 'in your plan '}match those kinds.</p>
            )}
          </Group>

          <Group label="How many">
            <div className="flex items-center gap-3">
              <Button variant="secondary" className="px-2.5" aria-label="Fewer" disabled={count <= 1} onClick={() => setCount(count - 1)}>
                <Minus aria-hidden className="size-4" />
              </Button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {count}
              </span>
              <Button variant="secondary" className="px-2.5" aria-label="More" disabled={count >= 10} onClick={() => setCount(count + 1)}>
                <Plus aria-hidden className="size-4" />
              </Button>
            </div>
          </Group>
          {error && <InlineError>{error}</InlineError>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            <Sparkles aria-hidden className="size-4" /> Generate {count}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

function Group({ label, hint, action, children }: { label: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p id={id} className="text-sm font-medium">
          {label}
          {hint && <span className="ml-2 font-normal text-faint">{hint}</span>}
        </p>
        {action}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'rounded-full px-3 py-1.5 text-sm transition-colors',
        on ? 'bg-accent font-medium text-accent-ink' : 'border border-line text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
