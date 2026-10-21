// Push reminders: turn notifications on for this device, and set when they come and what for.
// The send-reminders edge function checks every 5 minutes and only sends a reminder when
// questions of its kind are still open today.

import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, Plus, Send, Share, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import { pushState, turnOff, turnOn, type PushState } from '../../lib/push'
import type { Reminder, ReminderInput, ReminderKind } from '../../lib/types'
import { Button, Card, InlineError, Skeleton } from '../../components/ui'
import { cx } from '../../lib/cx'

const KIND_LABEL: Record<ReminderKind, string> = {
  coding: 'Coding questions',
  talk: 'Talk-through questions',
  any: 'Anything left today',
}
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS = [1, 2, 3, 4, 5]
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

const DEFAULTS: ReminderInput[] = [
  { at: '13:00', kind: 'coding', days: WEEKDAYS, enabled: true, timezone: '' },
  { at: '17:30', kind: 'talk', days: WEEKDAYS, enabled: true, timezone: '' },
]

export function Reminders() {
  const { data, error, loading, reload } = useAsync(() => db.listReminders(), [])
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  const add = (r: ReminderInput) => db.saveReminder({ ...r, timezone: timezone() })

  return (
    <Card as="section">
      <h2 className="font-semibold">Reminders</h2>
      <p className="mt-1 text-sm text-muted">
        A notification on your phone when today's questions are waiting. It's skipped if you've already done them.
      </p>

      <ThisDevice
        onFirstOn={() => (data && data.length === 0 ? run(() => Promise.all(DEFAULTS.map(add))) : undefined)}
      />

      {error && <InlineError>{error}</InlineError>}
      {loading && !data ? (
        <Skeleton className="mt-5 h-24 w-full rounded-xl" />
      ) : (
        <ul className="mt-5 space-y-3">
          {(data ?? []).map((r) => (
            <ReminderRow
              key={r.id}
              r={r}
              onSave={(patch) => run(() => db.saveReminder({ ...r, ...patch, timezone: timezone() }))}
              onRemove={() => run(() => db.removeReminder(r.id))}
            />
          ))}
        </ul>
      )}
      {actionError && (
        <div className="mt-3">
          <InlineError>{actionError}</InlineError>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run(() => add({ at: '09:00', kind: 'any', days: WEEKDAYS, enabled: true, timezone: '' }))}>
          <Plus aria-hidden className="size-4" /> Add a reminder
        </Button>
        {data?.length === 0 && (
          <Button variant="ghost" onClick={() => run(() => Promise.all(DEFAULTS.map(add)))}>
            Use the defaults (1 PM coding, 5:30 PM talk-through)
          </Button>
        )}
      </div>
      <p className="mt-4 text-xs text-faint">Times are in your time zone ({timezone()}).</p>
    </Card>
  )
}

function ThisDevice({ onFirstOn }: { onFirstOn: () => void }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    pushState().then(setState, () => setState('off'))
  }, [])

  async function act(fn: () => Promise<PushState | void>) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const next = await fn()
      if (next) setState(next)
      return next
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    await act(async () => {
      const r = await db.sendTestPush()
      setNote(r.sent ? 'Sent. It should show up in a few seconds.' : "Nothing was sent: this device isn't registered. Turn notifications off and on again.")
    })
  }

  if (!state) return <Skeleton className="mt-5 h-16 w-full rounded-xl" />

  return (
    <div className="mt-5 rounded-xl border border-line bg-bg p-4">
      {state === 'needs-install' && (
        <div className="flex gap-3">
          <Share aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="text-sm">
            <p className="font-medium">First, add this app to your Home Screen</p>
            <p className="mt-1 text-muted">
              iPhone only sends notifications to apps on the Home Screen. In Safari, tap <span className="font-medium text-ink">Share</span>, then{' '}
              <span className="font-medium text-ink">Add to Home Screen</span>. Open MLE Coach from there, sign in, and come back to this page.
            </p>
          </div>
        </div>
      )}
      {state === 'unsupported' && <p className="text-sm text-muted">This browser can't show notifications. Use the app on your phone instead.</p>}
      {state === 'denied' && (
        <div className="flex gap-3">
          <BellOff aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
          <p className="text-sm text-muted">
            Notifications are blocked for this app. Allow them in your phone's Settings (on iPhone: Settings, Notifications, MLE Coach), then reload.
          </p>
        </div>
      )}
      {state === 'off' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Notifications are off on this device.</p>
          <Button
            busy={busy}
            onClick={() =>
              act(async () => {
                const next = await turnOn()
                if (next === 'on') onFirstOn()
                return next
              })
            }
          >
            <Bell aria-hidden className="size-4" /> Turn on notifications
          </Button>
        </div>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text">
            <Check aria-hidden className="size-4" /> On for this device
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" busy={busy} onClick={test}>
              <Send aria-hidden className="size-4" /> Send a test
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => act(turnOff)}>
              Turn off
            </Button>
          </div>
        </div>
      )}
      {note && <p className="mt-3 text-sm text-muted" role="status">{note}</p>}
      {error && (
        <div className="mt-3">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </div>
  )
}

function ReminderRow({ r, onSave, onRemove }: { r: Reminder; onSave: (patch: Partial<ReminderInput>) => void; onRemove: () => void }) {
  const [at, setAt] = useState(r.at.slice(0, 5))
  useEffect(() => setAt(r.at.slice(0, 5)), [r.at])
  const toggleDay = (d: number) => onSave({ days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort() })

  return (
    <li className={cx('rounded-xl border border-line p-4', !r.enabled && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="time"
          aria-label="Time"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          onBlur={() => at && at !== r.at.slice(0, 5) && onSave({ at })}
          className="rounded-lg border border-line bg-bg px-3 py-2 text-base font-semibold tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        <select
          aria-label="Remind me about"
          value={r.kind}
          onChange={(e) => onSave({ kind: e.target.value as ReminderKind })}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm sm:w-auto sm:min-w-0 sm:flex-1 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        >
          {(Object.keys(KIND_LABEL) as ReminderKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Days" className="flex gap-1">
          {DAYS.map((label, d) => (
            <button
              key={d}
              type="button"
              aria-pressed={r.days.includes(d)}
              aria-label={DAY_NAMES[d]}
              onClick={() => toggleDay(d)}
              className={cx(
                'size-8 rounded-full text-xs font-semibold transition-colors',
                r.days.includes(d) ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <label className="inline-flex cursor-pointer items-center gap-2 px-2 text-sm text-muted">
            <input type="checkbox" checked={r.enabled} onChange={(e) => onSave({ enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
            On
          </label>
          <Button variant="ghost" onClick={onRemove} aria-label="Delete reminder" className="px-2.5">
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  )
}
