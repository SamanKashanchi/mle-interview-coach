import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleDashed, ExternalLink, Lightbulb, SearchX, TrendingUp } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { CONFIDENCE_LABEL, ROUND_LABEL, SOURCE_KIND_LABEL, formatDate } from '../../lib/format'
import type { ProfileSource, ResearchDetail, RoundView, TargetView } from '../../lib/types'
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { cx } from '../../lib/cx'

export default function Research() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useAsync(async () => {
    const target = (await db.listTargets()).find((t) => t.id === id) ?? null
    const research = target ? await db.getResearch(target.company_id, target.role_id) : null
    return { target, research }
  }, [id])

  if (error) return <><Back /><ErrorState message={error} onRetry={reload} className="mt-6" /></>
  if (loading || !data) return <ResearchSkeleton />

  const { target, research } = data
  if (!target) {
    return (
      <>
        <Back />
        <div className="mt-6">
          <EmptyState title="Target not found">It may have been removed.</EmptyState>
        </div>
      </>
    )
  }

  const done = research?.profile.status === 'done' ? research : null
  return (
    <article>
      <Back />
      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">How {target.company} interviews</h1>
        <p className="mt-1 text-muted">{target.role}</p>
        {done && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {done.profile.confidence && <Badge tone={done.profile.confidence === 'low' ? 'warn' : 'accent'}>{CONFIDENCE_LABEL[done.profile.confidence]}</Badge>}
            {done.profile.researched_at && <Badge>Researched {formatDate(done.profile.researched_at)}</Badge>}
            <Badge>{done.rounds.length} rounds</Badge>
            <Badge>{done.sources.length} sources</Badge>
          </div>
        )}
      </header>

      {done ? <ResearchBody r={done} /> : <Pending target={target} status={research?.profile.status} />}
      {target.job_description && <Posting text={target.job_description} />}
    </article>
  )
}

function Back() {
  return (
    <Link to="/targets" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft aria-hidden className="size-4" /> Targets
    </Link>
  )
}

function Pending({ target, status }: { target: TargetView; status?: string }) {
  const running = status === 'running'
  return (
    <div className="mt-8">
      <EmptyState icon={<CircleDashed className="size-6" />} title={running ? 'Research is running' : 'Not researched yet'}>
        <p>
          {running
            ? `Claude is reading up on how ${target.company} interviews for ${target.role}. The rounds, topics and sources will appear here when it's done.`
            : status === 'failed'
              ? `The last research run for ${target.company} didn't finish. It will be retried the next time research runs.`
              : `There's no research yet for ${target.company}, ${target.role}. Claude adds it the next time research runs from the project chat.`}
        </p>
        <p className="mt-3">Missing for now: the interview rounds, the topics each one tests, and the sources behind them. Until then this target doesn't shape your plan or questions.</p>
      </EmptyState>
    </div>
  )
}

function ResearchBody({ r }: { r: ResearchDetail }) {
  const sourceNo = (id: string) => r.sources.findIndex((s) => s.id === id) + 1
  return (
    <>
      {r.profile.summary && (
        <Card className="mt-8">
          <p className="text-[17px] leading-relaxed">{r.profile.summary}</p>
        </Card>
      )}

      <section aria-labelledby="rounds" className="mt-12">
        <h2 id="rounds" className="text-lg font-semibold">The loop, round by round</h2>
        <ol className="mt-6">
          {r.rounds.map((round, i) => (
            <Round key={round.id} round={round} last={i === r.rounds.length - 1} sources={r.sources} sourceNo={sourceNo} />
          ))}
        </ol>
      </section>

      {r.profile.style_notes.length > 0 && (
        <Notes id="style" icon={<Lightbulb className="size-4" />} title="What they reward" items={r.profile.style_notes} />
      )}
      {r.profile.level_notes && (
        <section aria-labelledby="level" className="mt-10">
          <h2 id="level" className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp aria-hidden className="size-4 text-accent" /> Level expectations
          </h2>
          <p className="mt-3 text-muted">{r.profile.level_notes}</p>
        </section>
      )}
      {r.profile.gaps.length > 0 && (
        <Notes id="gaps" icon={<SearchX className="size-4" />} title="What the research couldn't find" items={r.profile.gaps} muted />
      )}

      <section aria-labelledby="sources" className="mt-10">
        <h2 id="sources" className="text-lg font-semibold">Sources</h2>
        <ol className="mt-4 space-y-2">
          {r.sources.map((s, i) => (
            <li key={s.id} id={`source-${s.id}`} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <span className="w-5 shrink-0 text-sm tabular-nums text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 font-medium text-accent-text underline-offset-2 hover:underline">
                  <span className="break-words">{s.title || hostname(s.url)}</span>
                  <ExternalLink aria-hidden className="mt-1 size-3.5 shrink-0" />
                </a>
                <p className="mt-0.5 text-xs text-muted">
                  {s.kind ? `${SOURCE_KIND_LABEL[s.kind]} · ` : ''}
                  {hostname(s.url)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

function Round({ round, last, sources, sourceNo }: { round: RoundView; last: boolean; sources: ProfileSource[]; sourceNo: (id: string) => number }) {
  const [open, setOpen] = useState<number | null>(null)
  const active = round.topics.find((t) => t.topic_id === open)
  const shape = [round.count != null && `${round.count} ${round.count === 1 ? 'round' : 'rounds'}`, round.minutes != null && `${round.minutes} min`].filter(Boolean).join(' × ')
  const cited = round.source_ids.map((id) => ({ id, n: sourceNo(id) })).filter((s) => s.n > 0 && sources.length)

  return (
    <li className="relative flex gap-4 pb-8">
      {!last && <span aria-hidden className="absolute left-[13px] top-8 bottom-0 w-px bg-line" />}
      <span aria-hidden className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold text-accent-text">
        {round.position}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-semibold">{round.name}</h3>
          <Badge>{ROUND_LABEL[round.type]}</Badge>
          {shape && <span className="text-sm text-muted">{shape}</span>}
        </div>
        {round.what_it_tests && <p className="mt-2 text-muted">{round.what_it_tests}</p>}

        {round.topics.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {round.topics.map((t) => (
                <button
                  key={t.topic_id}
                  type="button"
                  title={t.detail ?? undefined}
                  aria-pressed={open === t.topic_id}
                  onClick={() => setOpen(open === t.topic_id ? null : t.topic_id)}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                    open === t.topic_id ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface hover:border-accent/50',
                  )}
                >
                  {t.topic.name}
                  <span className="text-xs tabular-nums text-faint">{Math.round(t.weight * 100)}%</span>
                </button>
              ))}
            </div>
            {active?.detail && (
              <p className="mt-2 rounded-lg bg-raised px-3 py-2 text-sm" aria-live="polite">
                <span className="font-medium">{active.topic.name}:</span> {active.detail}
              </p>
            )}
          </div>
        )}

        {cited.length > 0 && (
          <p className="mt-3 text-xs text-faint">
            Sources{' '}
            {cited.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                <a href={`#source-${s.id}`} className="underline-offset-2 hover:text-ink hover:underline">
                  {s.n}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </li>
  )
}

function Notes({ id, icon, title, items, muted }: { id: string; icon: ReactNode; title: string; items: string[]; muted?: boolean }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden className="text-accent">{icon}</span> {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((n) => (
          <li key={n} className={cx('flex gap-3', muted && 'text-muted')}>
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-faint" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Posting({ text }: { text: string }) {
  return (
    <details className="group mt-10 rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none rounded-2xl px-5 py-4 font-medium marker:hidden sm:px-6">
        <span className="group-open:hidden">Show the job posting you added</span>
        <span className="hidden group-open:inline">Your job posting</span>
      </summary>
      <p className="whitespace-pre-wrap border-t border-line px-5 py-4 text-sm text-muted sm:px-6">{text}</p>
    </details>
  )
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function ResearchSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-6 h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-56" />
      <Skeleton className="mt-8 h-28 w-full rounded-2xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-8 flex gap-4">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
