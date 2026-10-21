import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Info, ListOrdered, Newspaper, Search } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { CATEGORIES, CATEGORY_LABEL, formatDate, pct } from '../../lib/format'
import type { Category, FocusTopicView } from '../../lib/types'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { cx } from '../../lib/cx'
import { fmtScore, topicStats, type TopicStat } from '../../lib/progress'
import { LevelPill } from '../../components/habit'

const TOP = 10

export default function Plan() {
  const { data: loaded, error, loading, reload } = useAsync(() => Promise.all([db.getFocusTopics(), db.getHistory()]), [])
  const data = loaded?.[0]
  const stats = useMemo(() => new Map(loaded ? topicStats(loaded[1], loaded[0]).map((t) => [t.topic_id, t]) : []), [loaded])
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [showAll, setShowAll] = useState(false)

  const ranked = useMemo(() => (data ?? []).map((f, i) => ({ ...f, rank: i + 1 })), [data])
  const present = useMemo(() => CATEGORIES.filter((c) => ranked.some((f) => f.topic.category === c)), [ranked])

  const header = <PageHeader title="Your plan" subtitle="What to practice most, ranked by how much it matters for your targets." />

  if (error) return <>{header}<ErrorState message={error} onRetry={reload} /></>
  if (loading || !data) return <>{header}<SkeletonList rows={5} /></>
  if (!data.length) {
    return (
      <>
        {header}
        <EmptyState icon={<ListOrdered className="size-6" />} title="Your plan isn't built yet">
          Once research on your targets is in, Claude weighs every topic by what those companies test, what your postings ask for, and what your resume already covers.
          <p className="mt-3">
            <Link to="/targets" className="font-medium text-accent-text underline-offset-2 hover:underline">Check research status</Link>
          </p>
        </EmptyState>
        <HowItsBuilt />
      </>
    )
  }

  const filtered = category === 'all' ? ranked : ranked.filter((f) => f.topic.category === category)
  const visible = showAll || category !== 'all' ? filtered : filtered.slice(0, TOP)
  const max = Math.max(...ranked.map((f) => f.weight))

  return (
    <>
      {header}
      <div role="group" aria-label="Filter by category" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip active={category === 'all'} onClick={() => setCategory('all')}>All</FilterChip>
        {present.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </FilterChip>
        ))}
      </div>

      <ol className="space-y-2">
        {visible.map((f) => (
          <TopicRow key={f.topic_id} f={f} max={max} stat={stats.get(f.topic_id)} />
        ))}
      </ol>

      {category === 'all' && filtered.length > TOP && (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? `Show top ${TOP}` : `Show all ${filtered.length}`}
        </Button>
      )}

      <p className="mt-6 text-xs text-faint">Updated {formatDate(data[0].updated_at)}</p>
      <HowItsBuilt />
    </>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function TopicRow({ f, max, stat }: { f: FocusTopicView & { rank: number }; max: number; stat?: TopicStat }) {
  const parts = parseReason(f.reason)
  return (
    <li className="rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="flex items-baseline gap-3">
        <span className="w-6 shrink-0 text-sm tabular-nums text-faint">{f.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-semibold">{f.topic.name}</p>
            <span className="text-sm font-semibold tabular-nums text-accent-text">{pct(f.weight)}</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
            role="meter"
            aria-label={`${f.topic.name} share of practice`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(f.weight * 1000) / 10}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${(f.weight / max) * 100}%` }} />
          </div>
          {stat && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <LevelPill level={stat.level} />
              {stat.avg != null && (
                <span>
                  avg {fmtScore(stat.avg)} over {stat.scores.length} graded
                </span>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{CATEGORY_LABEL[f.topic.category]}</Badge>
            {f.posting_factor !== 1 && <Badge tone={f.posting_factor > 1 ? 'accent' : 'neutral'}>Posting ×{f.posting_factor}</Badge>}
            {f.resume_factor !== 1 && <Badge tone={f.resume_factor > 1 ? 'warn' : 'neutral'}>{f.resume_factor > 1 ? 'Resume gap' : 'Resume strength'} ×{f.resume_factor}</Badge>}
          </div>
          {parts.length > 0 && (
            <dl className="mt-3 space-y-1 text-sm text-muted">
              {parts.map(([k, v]) => (
                <div key={k + v} className="flex gap-2">
                  {k && <dt className="w-16 shrink-0 font-medium text-ink/70">{k}</dt>}
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </li>
  )
}

const REASON_LABEL: Record<string, string> = { research: 'Research', posting: 'Posting', resume: 'Resume' }

/** Reasons are written as "research: ...; posting: ...; resume: ...". Split them into labelled lines. */
function parseReason(reason: string | null): [string, string][] {
  if (!reason) return []
  return reason.split('; ').reduce<[string, string][]>((out, part) => {
    const m = part.match(/^(research|posting|resume): (.*)$/)
    if (m) out.push([REASON_LABEL[m[1]], m[2]])
    else if (out.length && part && !/^not in research/.test(part)) out[out.length - 1][1] += `; ${part}`
    else out.push(['', part.replace(/^not in research \(minimum weight\)$/, 'Not in the research yet, so it keeps a small baseline share.')])
    return out
  }, [])
}

function HowItsBuilt() {
  return (
    <Card as="section" className="mt-10 bg-transparent">
      <h2 className="flex items-center gap-2 font-semibold">
        <Info aria-hidden className="size-4 text-accent" /> How this is built
      </h2>
      <p className="mt-2 text-sm text-muted">Every one of the 42 topics gets a weight from three factors, multiplied together and then scaled so they add up to 100%.</p>
      <ul className="mt-4 space-y-4 text-sm">
        <Factor icon={<Search className="size-4" />} title="Research">
          How often the topic comes up in each target company's rounds, weighted by how many of that round there are. Topics no source mentions keep a small floor.
        </Factor>
        <Factor icon={<Newspaper className="size-4" />} title="Job posting">
          Between ×0.5 and ×1.5. Topics a posting names explicitly go up.
        </Factor>
        <Factor icon={<FileText className="size-4" />} title="Resume">
          Between ×0.5 and ×1.5. Gaps in your experience go up; clear strengths come down.
        </Factor>
      </ul>
    </Card>
  )
}

function Factor({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted">{children}</p>
      </div>
    </li>
  )
}
