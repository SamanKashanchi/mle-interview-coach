// LeetCode-style workspace for coding questions: the problem on the left, a real editor on the
// right, and a console under it. Run checks the visible test cases; Submit runs every case
// (hidden ones too), saves the code with its results as an attempt, and sends it for grading.

import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Check, CircleDashed, Clock, LoaderCircle, Play, RotateCcw, Send, X } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { clock, useElapsed } from '../../lib/useElapsed'
import { formatDate } from '../../lib/format'
import { cx } from '../../lib/cx'
import { LANGUAGE_LABEL, runCode, STATUS_LABEL, TIME_LIMIT_MS, warmUp } from '../../lib/runner/runner'
import type { AnswerView, CaseResult, CodeSpec, QuestionView, RunResult, Shown } from '../../lib/types'
import { Button, ErrorState, InlineError, Skeleton } from '../../components/ui'
import { ScorePill } from '../../components/habit'
import { Details, Feedback, Pending, Rubric } from './AnswerPanel'

const CodeEditor = lazy(() => import('../../components/code/CodeEditor'))

type Q = QuestionView & { code: CodeSpec }

export default function CodeWorkspace({ q, header, footer }: { q: Q; header: ReactNode; footer: ReactNode }) {
  const answers = useAsync(() => db.getAnswers(q.id), [q.id])
  const [tab, setTab] = useState<'description' | 'submissions'>('description')

  useEffect(() => warmUp(q.code.language), [q.code.language])

  return (
    <div className="mt-4 flex flex-col gap-4 lg:grid lg:h-[calc(100dvh-5.5rem)] lg:min-h-[36rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <Tabs
          label="Problem"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'description', label: 'Description' },
            { value: 'submissions', label: `Submissions${answers.data?.length ? ` (${answers.data.length})` : ''}` },
          ]}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === 'description' ? (
            <>
              {header}
              {footer}
            </>
          ) : answers.error ? (
            <ErrorState message={answers.error} onRetry={answers.reload} />
          ) : !answers.data ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <Submissions q={q} attempts={answers.data} />
          )}
        </div>
      </section>

      {answers.data ? (
        <Workbench
          q={q}
          latest={answers.data[0]}
          attempt={answers.data.length + 1}
          onSubmitted={() => {
            answers.reload()
            setTab('submissions')
          }}
        />
      ) : (
        <Skeleton className="h-[32rem] w-full rounded-2xl lg:h-full" />
      )}
    </div>
  )
}

// ---- Editor and console ----

const draftKey = (id: string) => `code:${id}`

function readDraft(id: string) {
  try {
    return localStorage.getItem(draftKey(id))
  } catch {
    return null
  }
}

function writeDraft(id: string, code: string) {
  try {
    localStorage.setItem(draftKey(id), code)
  } catch {
    // A lost draft is fine; submitted code is saved with the attempt.
  }
}

type Stage = 'idle' | 'loading' | 'running'

function Workbench({ q, latest, attempt, onSubmitted }: { q: Q; latest?: AnswerView; attempt: number; onSubmitted: () => void }) {
  const spec = q.code
  const [code, setCode] = useState(() => readDraft(q.id) ?? (latest?.language === spec.language ? latest.body : spec.starter))
  const [stage, setStage] = useState<Stage>('idle')
  const [busy, setBusy] = useState<'run' | 'submit' | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [consoleTab, setConsoleTab] = useState<'testcase' | 'result'>('testcase')
  const [height, setHeight] = useState(260)
  const elapsed = useElapsed()
  const visible = spec.tests.filter((t) => !t.hidden)

  useEffect(() => writeDraft(q.id, code), [q.id, code])

  async function go(kind: RunResult['kind']) {
    if (busy) return
    if (!code.trim()) return setError('Write some code first.')
    setBusy(kind)
    setError(null)
    setConsoleTab('result')
    setResult(null)
    try {
      const r = await runCode(spec, code, kind, setStage)
      setResult(r)
      if (kind === 'submit') {
        await db.submitAnswer(q.id, code, elapsed, { language: spec.language, run_result: r })
        onSubmitted()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
      setStage('idle')
    }
  }

  function reset() {
    if (code !== spec.starter && !confirm('Replace your code with the starter code?')) return
    setCode(spec.starter)
  }

  const over = elapsed > q.minutes * 60
  return (
    <section aria-label="Code" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <span className="truncate text-sm font-medium">
          {LANGUAGE_LABEL[spec.language]}
          {attempt > 1 && <span className="font-normal text-muted"> · attempt {attempt}</span>}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums', over ? 'text-warn-text' : 'text-muted')} aria-live="off">
            <Clock aria-hidden className="size-4" />
            {clock(elapsed)} <span className="hidden text-faint sm:inline">of {q.minutes}:00</span>
          </span>
          <button type="button" onClick={reset} className="rounded-md p-1.5 text-faint hover:bg-raised hover:text-ink" title="Reset to starter code" aria-label="Reset to starter code">
            <RotateCcw aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      <div className="h-[55dvh] min-h-[16rem] lg:h-auto lg:flex-1">
        <Suspense fallback={<div className="p-4 text-sm text-muted">Loading editor…</div>}>
          <CodeEditor language={spec.language} value={code} onChange={setCode} onRun={() => go('run')} label={`Code editor, ${LANGUAGE_LABEL[spec.language]}`} />
        </Suspense>
      </div>

      <ResizeHandle height={height} onChange={setHeight} />
      <div className="flex shrink-0 flex-col border-t border-line lg:max-h-[70%]" style={{ height }}>
        <Tabs
          label="Console"
          value={consoleTab}
          onChange={setConsoleTab}
          items={[
            { value: 'testcase', label: 'Testcase' },
            { value: 'result', label: 'Test result' },
          ]}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {consoleTab === 'testcase' ? (
            <CasePicker
              cases={visible.map((t, i) => ({ key: t.name, label: `Case ${i + 1}`, title: t.name }))}
              render={(i) => <Testcase spec={spec} index={i} />}
            />
          ) : (
            <ResultView stage={stage} result={result} language={spec.language} />
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="min-w-0 text-xs text-muted">
          {error ? (
            <InlineError>{error}</InlineError>
          ) : (
            <span className="hidden sm:inline">
              <kbd className="rounded border border-line px-1 font-sans">Ctrl</kbd> + <kbd className="rounded border border-line px-1 font-sans">Enter</kbd> to run
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => go('run')} busy={busy === 'run'} disabled={!!busy}>
            <Play aria-hidden className="size-4" /> Run
          </Button>
          <Button onClick={() => go('submit')} busy={busy === 'submit'} disabled={!!busy}>
            <Send aria-hidden className="size-4" /> Submit
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Drag to resize the console (desktop only). */
function ResizeHandle({ height, onChange }: { height: number; onChange: (h: number) => void }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize console"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') onChange(Math.min(height + 24, 640))
        if (e.key === 'ArrowDown') onChange(Math.max(height - 24, 120))
      }}
      onPointerDown={(e) => {
        const startY = e.clientY
        const start = height
        const move = (ev: PointerEvent) => onChange(Math.min(Math.max(start + startY - ev.clientY, 120), 640))
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          document.body.style.userSelect = ''
        }
        document.body.style.userSelect = 'none'
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      className="group hidden h-2 shrink-0 cursor-row-resize items-center justify-center lg:flex"
    >
      <span className="h-1 w-10 rounded-full bg-line group-hover:bg-accent group-focus-visible:bg-accent" />
    </div>
  )
}

function Testcase({ spec, index }: { spec: CodeSpec; index: number }) {
  const t = spec.tests.filter((x) => !x.hidden)[index]
  if (spec.language === 'python') {
    const names = spec.params?.length === t.args?.length ? spec.params! : (t.args ?? []).map((_, i) => `arg${i + 1}`)
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted">{t.name}</p>
        {(t.args ?? []).map((a, i) => (
          <Field key={names[i]} label={`${names[i]} =`}>
            <Value value={{ text: JSON.stringify(a) }} />
          </Field>
        ))}
        <Field label="Expected">
          <Value value={{ text: JSON.stringify(t.expected) }} />
        </Field>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t.name}. The example tables load into an empty database before your query runs.</p>
      <Field label="Rows">
        <pre className="max-h-48 overflow-auto rounded-lg bg-raised px-3 py-2 font-mono text-xs leading-relaxed">{t.setup}</pre>
      </Field>
      <Field label="Expected">
        <Value value={{ table: t.expected as never }} />
      </Field>
    </div>
  )
}

function ResultView({ stage, result, language }: { stage: Stage; result: RunResult | null; language: CodeSpec['language'] }) {
  if (stage !== 'idle') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        {stage === 'loading' ? `Starting ${LANGUAGE_LABEL[language]}. This takes a few seconds the first time.` : 'Running…'}
      </p>
    )
  }
  if (!result) return <p className="text-sm text-muted">Run your code to see the results here.</p>

  const ok = result.status === 'accepted'
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1" role="status">
        <span className={cx('text-lg font-semibold', ok ? 'text-accent-text' : 'text-danger')}>{STATUS_LABEL[result.status]}</span>
        <span className="text-sm text-muted">
          {result.passed} / {result.total} {result.kind === 'run' ? 'examples' : 'tests'} passed
          {result.cases.length > 0 && ` · ${result.ms} ms`}
        </span>
      </p>
      {result.error ? (
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger">
          {result.status === 'time_limit' ? `${result.error} Check for an endless loop. The limit is ${TIME_LIMIT_MS / 1000} s per run.` : result.error}
        </pre>
      ) : (
        <CasePicker
          className="mt-3"
          initial={Math.max(0, result.cases.findIndex((c) => c.status !== 'pass'))}
          cases={result.cases.map((c, i) => ({
            key: `${c.name}-${i}`,
            label: c.hidden ? `Hidden ${i + 1 - result.cases.filter((x) => !x.hidden).length}` : `Case ${i + 1}`,
            title: c.name,
            status: c.status,
          }))}
          render={(i) => <CaseDetail c={result.cases[i]} />}
        />
      )}
    </div>
  )
}

function CaseDetail({ c }: { c: CaseResult }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{c.name}</p>
      {c.error && <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger">{c.error}</pre>}
      {c.inputs.map((x) => (
        <Field key={x.label} label={'text' in x.value ? `${x.label} =` : x.label}>
          <Value value={x.value} />
        </Field>
      ))}
      {c.stdout && (
        <Field label="Stdout">
          <pre className="max-h-40 overflow-auto rounded-lg bg-raised px-3 py-2 font-mono text-xs">{c.stdout}</pre>
        </Field>
      )}
      {c.output && (
        <Field label="Output">
          <Value value={c.output} tone={c.status === 'fail' ? 'bad' : undefined} />
        </Field>
      )}
      <Field label="Expected">
        <Value value={c.expected} tone={c.status === 'pass' ? 'good' : undefined} />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      {children}
    </div>
  )
}

function Value({ value, tone }: { value: Shown; tone?: 'good' | 'bad' }) {
  const ring = tone === 'bad' ? 'ring-1 ring-danger/50' : tone === 'good' ? 'ring-1 ring-accent/40' : ''
  if ('text' in value) {
    return <pre className={cx('max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-raised px-3 py-2 font-mono text-sm', ring)}>{value.text}</pre>
  }
  const { columns, rows } = value.table
  return (
    <div className={cx('max-h-56 overflow-auto rounded-lg bg-raised', ring)}>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={`${c}-${i}`} className="sticky top-0 border-b border-line bg-raised px-3 py-1.5 text-left font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length || 1} className="px-3 py-1.5 text-muted">
                (no rows)
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                {r.map((v, j) => (
                  <td key={j} className={cx('whitespace-nowrap px-3 py-1.5', v == null && 'text-faint')}>
                    {v == null ? 'null' : String(v)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CasePicker({
  cases,
  render,
  initial = 0,
  className,
}: {
  cases: { key: string; label: string; title: string; status?: CaseResult['status'] }[]
  render: (i: number) => ReactNode
  initial?: number
  className?: string
}) {
  const [i, setI] = useState(initial)
  const current = Math.min(i, cases.length - 1)
  if (!cases.length) return <p className="text-sm text-muted">No test cases.</p>
  return (
    <div className={className}>
      <div role="tablist" aria-label="Test cases" className="flex flex-wrap gap-1.5">
        {cases.map((c, k) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={k === current}
            title={c.title}
            onClick={() => setI(k)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
              k === current ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60',
            )}
          >
            {c.status && (
              <span aria-hidden className={cx('size-1.5 rounded-full', c.status === 'pass' ? 'bg-accent' : 'bg-danger')} />
            )}
            {c.label}
            {c.status && <span className="sr-only">{c.status === 'pass' ? ', passed' : ', failed'}</span>}
          </button>
        ))}
      </div>
      <div className="mt-3">{render(current)}</div>
    </div>
  )
}

function Tabs<T extends string>({ label, value, onChange, items }: { label: string; value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" aria-label={label} className="flex h-11 shrink-0 items-end gap-4 border-b border-line px-4">
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px border-b-2 pb-2.5 text-sm font-medium',
            t.value === value ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ---- Submissions ----

function Submissions({ q, attempts }: { q: Q; attempts: AnswerView[] }) {
  if (!attempts.length) {
    return (
      <div>
        <p className="text-muted">No submissions yet. Submit runs every test, hidden ones included, and sends your code for grading.</p>
        <Rubric items={q.rubric} />
      </div>
    )
  }
  const [latest, ...earlier] = attempts
  return (
    <div>
      <AttemptHeader a={latest} />
      {latest.grade ? <Feedback grade={latest.grade} code /> : <Pending />}
      <Details summary="Submitted code" meta={formatDate(latest.created_at, { month: 'short', day: 'numeric' })}>
        <pre className="overflow-x-auto font-mono text-sm">{latest.body}</pre>
      </Details>
      {!latest.grade && <Rubric items={q.rubric} />}
      {earlier.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-semibold">Earlier attempts</h3>
          {earlier.map((a) => (
            <Details key={a.id} summary={a.run_result ? STATUS_LABEL[a.run_result.status] : 'Submitted'} meta={attemptMeta(a)}>
              <pre className="overflow-x-auto font-mono text-sm">{a.body}</pre>
            </Details>
          ))}
        </>
      )}
    </div>
  )
}

function AttemptHeader({ a }: { a: AnswerView }) {
  const r = a.run_result
  const ok = r?.status === 'accepted'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {r ? (
        <span className={cx('inline-flex items-center gap-1.5 text-xl font-semibold', ok ? 'text-accent-text' : 'text-danger')}>
          {ok ? <Check aria-hidden className="size-5" /> : <X aria-hidden className="size-5" />}
          {STATUS_LABEL[r.status]}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xl font-semibold">
          <CircleDashed aria-hidden className="size-5 text-faint" /> Submitted
        </span>
      )}
      <span className="text-sm text-muted">{attemptMeta(a)}</span>
      {a.grade && <ScorePill score={Number(a.grade.score)} />}
    </div>
  )
}

function attemptMeta(a: AnswerView) {
  const parts = [formatDate(a.created_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })]
  if (a.run_result) parts.unshift(`${a.run_result.passed} / ${a.run_result.total} tests`)
  if (a.seconds_spent != null) parts.push(`${Math.max(1, Math.round(a.seconds_spent / 60))} min`)
  return parts.join(' · ')
}
