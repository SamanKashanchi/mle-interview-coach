// The habit loop's visual pieces: goal ring, score and level pills, activity
// calendar, daily score bars and one-time toasts. Numbers come from lib/progress.

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { cx } from '../lib/cx'
import { formatDate, scoreLabel } from '../lib/format'
import { addDays, fmtScore, LEVEL_LABEL, LEVELS, type Day, type DayActivity, type Level } from '../lib/progress'

// ---- Goal ring (Apple Fitness) ----

export function GoalRing({ minutes, goal, size = 88 }: { minutes: number; goal: number; size?: number }) {
  const ratio = goal > 0 ? Math.min(minutes / goal, 1) : 0
  const met = goal > 0 && minutes >= goal
  const stroke = size / 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {met ? (
          <span className="animate-pop flex size-8 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Check aria-hidden className="size-5" strokeWidth={3} />
          </span>
        ) : (
          <>
            <span className="text-lg font-semibold leading-none tabular-nums">{Math.round(minutes)}</span>
            <span className="mt-0.5 text-[11px] text-muted">of {goal}</span>
          </>
        )}
      </div>
      <span className="sr-only">
        {Math.round(minutes)} of {goal} minutes practiced today{met ? ', goal met' : ''}
      </span>
    </div>
  )
}

// ---- Scores and levels ----

const SCORE_TONE: Record<string, string> = {
  'Needs work': 'bg-danger-soft text-danger',
  'Getting there': 'bg-warn-soft text-warn-text',
  Solid: 'bg-accent-soft text-accent-text',
  'Interview-ready': 'bg-accent text-accent-ink',
}

export function ScorePill({ score, className, suffix = '/5' }: { score: number; className?: string; suffix?: string }) {
  return (
    <span
      className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', SCORE_TONE[scoreLabel(score)], className)}
      title={scoreLabel(score)}
    >
      {fmtScore(score)}
      {suffix}
    </span>
  )
}

export function LevelPill({ level, className }: { level: Level; className?: string }) {
  const step = LEVELS.indexOf(level)
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', step === 0 ? 'text-faint' : 'text-accent-text', className)}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cx('h-1.5 w-3 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
        ))}
      </span>
      {LEVEL_LABEL[level]}
    </span>
  )
}

// ---- Activity calendar (GitHub contributions) ----

/** Sequential teal: more of the accent for a higher average grade. */
function heat(avg: number | null) {
  if (avg == null) return 'color-mix(in oklab, var(--accent) 18%, var(--raised))'
  const share = avg < 2 ? 32 : avg < 3 ? 52 : avg < 4 ? 76 : 100
  return `color-mix(in oklab, var(--accent) ${share}%, var(--raised))`
}

export function ActivityCalendar({
  activity,
  today,
  hasQuestions,
  weeks = 12,
}: {
  activity: Map<Day, DayActivity>
  today: Day
  hasQuestions: Set<Day>
  weeks?: number
}) {
  // Columns are weeks starting Monday; the last column holds today.
  const dow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7
  const start = addDays(today, -dow - (weeks - 1) * 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
  return (
    <div className="max-w-[26rem]">
      <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const a = activity.get(d)
          const future = d > today
          const label = `${formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })} · ${
            a ? `${a.answered} answered${a.avg != null ? ` · avg ${fmtScore(a.avg)}` : ''}` : 'no practice'
          }`
          const cell = (
            <span
              className={cx(
                'block aspect-square w-full rounded-[4px]',
                d === today && 'outline outline-2 outline-offset-1 outline-ink/40',
                future && 'opacity-0',
              )}
              style={{ background: a ? heat(a.avg) : 'var(--raised)' }}
            />
          )
          if (future) return <span key={d} aria-hidden>{cell}</span>
          return hasQuestions.has(d) || a ? (
            <Link key={d} to={`/history/${d}`} title={label} aria-label={label} className="rounded-[4px]">
              {cell}
            </Link>
          ) : (
            <span key={d} title={label} aria-label={label} role="img">
              {cell}
            </span>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>{weeks} weeks</span>
        <span className="flex items-center gap-1.5">
          Lower avg
          {[1.5, 2.5, 3.5, 4.5].map((s) => (
            <span key={s} className="size-3 rounded-[3px]" style={{ background: heat(s) }} />
          ))}
          Higher
        </span>
      </div>
    </div>
  )
}

// ---- Daily average bars ----

export function DailyScores({ points }: { points: { day: Day; avg: number | null; answered: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover != null ? points[hover] : null
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">Daily average grade</span>
        <span className="text-muted tabular-nums" aria-live="polite">
          {shown
            ? `${formatDate(shown.day, { month: 'short', day: 'numeric' })}: ${shown.avg != null ? `${fmtScore(shown.avg)}/5` : shown.answered ? 'not graded yet' : 'no practice'}`
            : `Last ${points.length} days`}
        </span>
      </figcaption>
      <div className="relative mt-3 h-28" onMouseLeave={() => setHover(null)}>
        {[0, 2.5, 5].map((v) => (
          <div key={v} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(v / 5) * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[10px] leading-none text-faint">{v}</span>
          </div>
        ))}
        <div className="absolute inset-0 right-5 flex items-end gap-0.5">
          {points.map((p, i) => (
            <button
              key={p.day}
              type="button"
              aria-label={`${formatDate(p.day, { month: 'short', day: 'numeric' })}: ${p.avg != null ? `average ${fmtScore(p.avg)} of 5` : 'no grades'}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="flex h-full flex-1 items-end justify-center"
            >
              {p.avg != null ? (
                <span
                  className={cx('w-full max-w-5 rounded-t-[4px] bg-accent transition-opacity', hover != null && hover !== i && 'opacity-50')}
                  style={{ height: `${Math.max((p.avg / 5) * 100, 3)}%` }}
                />
              ) : (
                <span className="h-0.5 w-full max-w-5 rounded-full bg-line" />
              )}
            </button>
          ))}
        </div>
      </div>
    </figure>
  )
}

// ---- One-time toasts ----

const seenKey = (id: string) => `seen:${id}`

function seen(id: string) {
  try {
    return localStorage.getItem(seenKey(id)) === '1'
  } catch {
    return true // No storage: never nag.
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(seenKey(id), '1')
  } catch {
    // Fine.
  }
}

/** Shows each message once per device, then never again. */
export function OnceToasts({ items }: { items: { id: string; icon?: ReactNode; message: ReactNode }[] }) {
  const [shown, setShown] = useState<typeof items>([])
  const ids = items.map((i) => i.id).join('|')

  useEffect(() => {
    const fresh = items.filter((i) => !seen(i.id))
    fresh.forEach((i) => markSeen(i.id))
    if (!fresh.length) return
    setShown(fresh)
    const t = setTimeout(() => setShown([]), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  if (!shown.length) return null
  return (
    <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm flex-col gap-2 md:bottom-6">
      {shown.map((t) => (
        <div key={t.id} className="animate-rise flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg">
          {t.icon && <span className="shrink-0 text-accent-text">{t.icon}</span>}
          <p className="min-w-0 flex-1 text-sm">{t.message}</p>
          <button type="button" onClick={() => setShown((s) => s.filter((x) => x.id !== t.id))} className="text-faint hover:text-ink" aria-label="Dismiss">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---- Stat tile ----

export function Stat({ label, value, sub, to }: { label: string; value: ReactNode; sub?: ReactNode; to?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </>
  )
  const cls = 'block rounded-2xl border border-line bg-surface p-4'
  return to ? (
    <Link to={to} className={cx(cls, 'transition-colors hover:border-accent/50')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
