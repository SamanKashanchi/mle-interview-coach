import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, FileSearch, ListChecks, Plus, Sparkles, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useAuth } from '../../lib/useAuth'
import type { Profile, TargetInput } from '../../lib/types'
import { Button, Card, ErrorState, FullPageSpinner, InlineError, TextField } from '../../components/ui'
import { cx } from '../../lib/cx'
import { Logo } from '../../components/Logo'
import { LevelSelect, ResumeUpload, TargetFields, TimelineFields } from '../../components/forms'
import { cleanTarget, emptyTarget, parseMinutes, useSuggestions } from '../../lib/formHelpers'

const STEPS = ['About you', 'Targets', 'Resume', 'Timeline', 'Done']

type Row = TargetInput & { id?: string }

export default function Onboarding() {
  const { refreshSetup } = useAuth()
  const navigate = useNavigate()
  const suggestions = useSuggestions()

  const [loaded, setLoaded] = useState<'loading' | 'ready' | 'already-done'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyTarget()])
  const [savedRows, setSavedRows] = useState<Row[]>([])
  const [timeline, setTimeline] = useState({ readyBy: '', minutes: '60' })

  async function load() {
    setLoadError(null)
    try {
      const [p, targets] = await Promise.all([db.getProfile(), db.listTargets()])
      const existing = targets.map((t) => ({ id: t.id, company: t.company, role: t.role, job_description: t.job_description ?? '' }))
      if (p?.name && p.minutes_per_day != null && targets.length) {
        setLoaded('already-done')
        return
      }
      setProfile(p)
      setName(p?.name ?? '')
      setLevel(p?.level ?? '')
      setTimeline({ readyBy: p?.ready_by ?? '', minutes: String(p?.minutes_per_day ?? 60) })
      setRows(existing.length ? existing : [emptyTarget()])
      setSavedRows(existing)
      // Pick up where they left off.
      setStep(!p?.name ? 0 : !targets.length ? 1 : 2)
      setLoaded('ready')
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setStep((s) => s + 1)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const saveAbout = (e: FormEvent) => {
    e.preventDefault()
    void save(() => db.saveProfile({ name: name.trim(), level: level || null }))
  }

  const saveTargets = (e: FormEvent) => {
    e.preventDefault()
    void save(async () => {
      const filled = rows.map((r) => ({ ...cleanTarget(r), id: r.id })).filter((r) => r.company || r.role || r.job_description)
      if (!filled.length) throw new Error('Add at least one company and role.')
      if (filled.some((r) => !r.company || !r.role)) throw new Error('Each target needs both a company and a role.')
      for (const old of savedRows) {
        if (!filled.some((r) => r.id === old.id)) await db.removeTarget(old.id!)
      }
      for (const r of filled) {
        if (r.id) await db.updateTarget(r.id, r)
        else await db.addTarget(r)
      }
      const fresh = await db.listTargets()
      const next = fresh.map((t) => ({ id: t.id, company: t.company, role: t.role, job_description: t.job_description ?? '' }))
      setRows(next)
      setSavedRows(next)
    })
  }

  const saveTimeline = (e: FormEvent) => {
    e.preventDefault()
    const minutes = parseMinutes(timeline.minutes)
    if (!minutes) {
      setError('Enter how many minutes a day you can practice.')
      return
    }
    void save(async () => {
      await db.saveProfile({ ready_by: timeline.readyBy || null, minutes_per_day: minutes })
      await refreshSetup()
    })
  }

  async function reloadProfile() {
    setProfile(await db.getProfile())
  }

  if (loaded === 'already-done') return <Navigate to="/" replace />
  if (loadError) return <ErrorState message={loadError} onRetry={load} className="mx-auto mt-24 max-w-md" />
  if (loaded === 'loading') return <FullPageSpinner />

  const back = step > 0 && step < 4 && (
    <Button variant="ghost" onClick={() => { setError(null); setStep(step - 1) }}>
      <ArrowLeft aria-hidden className="size-4" /> Back
    </Button>
  )

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-8 sm:pt-12">
      <Logo />
      <Progress step={step} />

      {step === 0 && (
        <Step title="First, a little about you" lead="This sets the bar your questions are written for." onSubmit={saveAbout} footer={<Next busy={busy} />} error={error}>
          <TextField label="Your name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <LevelSelect value={level} onChange={setLevel} />
        </Step>
      )}

      {step === 1 && (
        <Step
          title="Where are you aiming?"
          lead="Add each company and role you're preparing for. You can change these later."
          onSubmit={saveTargets}
          footer={<>{back}<Next busy={busy} /></>}
          error={error}
        >
          <div className="space-y-6">
            {rows.map((row, i) => (
              <div key={row.id ?? `new-${i}`} className={cx(i > 0 && 'border-t border-line pt-6')}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted">Target {i + 1}</h3>
                  {rows.length > 1 && (
                    <Button variant="danger" className="min-h-8 px-2 py-1" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden className="size-4" /> Remove
                    </Button>
                  )}
                </div>
                <TargetFields value={row} suggestions={suggestions} onChange={(v) => setRows(rows.map((r, j) => (j === i ? { ...r, ...v } : r)))} />
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setRows([...rows, emptyTarget()])}>
            <Plus aria-hidden className="size-4" /> Add another target
          </Button>
        </Step>
      )}

      {step === 2 && (
        <Step
          title="Add your resume"
          lead="Optional. It lets the coach ask about your own projects and spend less time on what you already know well."
          onSubmit={(e) => { e.preventDefault(); setStep(3) }}
          footer={<>{back}<Next label={profile?.resume_name ? 'Continue' : 'Skip for now'} variant={profile?.resume_name ? 'primary' : 'secondary'} /></>}
          error={error}
        >
          <ResumeUpload name={profile?.resume_name ?? null} path={profile?.resume_path ?? null} onUploaded={reloadProfile} />
          <p className="text-xs text-muted">PDF or plain text. Only you can see it.</p>
        </Step>
      )}

      {step === 3 && (
        <Step title="Set your pace" lead="How long you have, and how much time you can give each day." onSubmit={saveTimeline} footer={<>{back}<Next busy={busy} label="Finish" /></>} error={error}>
          <TimelineFields readyBy={timeline.readyBy} minutes={timeline.minutes} onChange={setTimeline} />
        </Step>
      )}

      {step === 4 && (
        <section className="mt-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <Check aria-hidden className="size-6" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">You're all set{name ? `, ${name.split(' ')[0]}` : ''}.</h1>
          <p className="mt-2 text-muted">Here's what happens next. Claude researches each company, builds your plan, and writes your first questions.</p>
          <ol className="mt-8 space-y-3">
            <NextUp icon={<FileSearch className="size-5" />} title="Research each company" body="How they interview for your role: the rounds, what each one tests, and the topics that come up most." />
            <NextUp icon={<ListChecks className="size-5" />} title="Build your plan" body="A ranked list of topics, weighted by the research, your job postings and your resume." />
            <NextUp icon={<Sparkles className="size-5" />} title="Write your first questions" body="A daily set sized to your minutes per day, with what a strong answer covers." />
          </ol>
          <p className="mt-6 text-sm text-muted">Each of these shows up in your portal as soon as it's ready. Until then you'll see what's still on the way.</p>
          <Button className="mt-8" onClick={() => navigate('/', { replace: true })}>
            Go to my portal
          </Button>
        </section>
      )}
    </main>
  )
}

function Progress({ step }: { step: number }) {
  return (
    <nav aria-label="Setup progress" className="mt-10">
      <p className="text-sm text-muted">
        Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
        <span className="sr-only">: {STEPS[step]}</span>
      </p>
      <ol className="mt-3 grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined}>
            <div className={cx('h-1.5 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-line')} />
            <span className={cx('mt-2 hidden text-xs sm:block', i === step ? 'font-medium text-ink' : 'text-faint')}>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Step({
  title,
  lead,
  children,
  footer,
  error,
  onSubmit,
}: {
  title: string
  lead: string
  children: ReactNode
  footer: ReactNode
  error: string | null
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="mt-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 text-muted">{lead}</p>
      <Card className="mt-8 space-y-5">{children}</Card>
      {error && <div className="mt-4"><InlineError>{error}</InlineError></div>}
      <div className="mt-6 flex items-center justify-between gap-3">
        <span />
        <div className="flex flex-1 items-center justify-between gap-3">{footer}</div>
      </div>
    </form>
  )
}

function Next({ busy, label = 'Continue', variant = 'primary' }: { busy?: boolean; label?: string; variant?: 'primary' | 'secondary' }) {
  return (
    <Button type="submit" busy={busy} variant={variant} className="ml-auto">
      {label}
    </Button>
  )
}

function NextUp({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
      <span aria-hidden className="mt-0.5 text-accent-text">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
    </li>
  )
}
