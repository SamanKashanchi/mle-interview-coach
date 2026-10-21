import { useEffect, useState, type FormEvent } from 'react'
import { Check, LogOut } from 'lucide-react'
import { db } from '../../lib/db'
import { useAuth } from '../../lib/useAuth'
import { useAsync } from '../../lib/useAsync'
import type { Profile } from '../../lib/types'
import { Button, Card, ErrorState, InlineError, PageHeader, Skeleton, TextField } from '../../components/ui'
import { LevelSelect, ResumeUpload, TimelineFields } from '../../components/forms'
import { parseMinutes } from '../../lib/formHelpers'
import { Reminders } from './Reminders'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const { data, error, loading, reload } = useAsync(() => db.getProfile(), [])

  const header = <PageHeader title="Profile" subtitle={user?.email} />
  if (error) return <>{header}<ErrorState message={error} onRetry={reload} /></>
  if (loading && !data) return <>{header}<ProfileSkeleton /></>

  return (
    <>
      {header}
      <div className="space-y-6">
        <DetailsForm profile={data ?? null} />
        <Reminders />
        <PasswordForm />
        <Card as="section">
          <h2 className="font-semibold">Resume</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Used for project deep-dive questions and to weigh your plan toward gaps.</p>
          <ResumeUpload name={data?.resume_name ?? null} path={data?.resume_path ?? null} onUploaded={reload} />
        </Card>
        <Button variant="secondary" onClick={signOut}>
          <LogOut aria-hidden className="size-4" /> Sign out
        </Button>
      </div>
    </>
  )
}

function DetailsForm({ profile }: { profile: Profile | null }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [level, setLevel] = useState(profile?.level ?? '')
  const [timeline, setTimeline] = useState({ readyBy: profile?.ready_by ?? '', minutes: String(profile?.minutes_per_day ?? '') })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setSaved(false), [name, level, timeline])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const minutes = parseMinutes(timeline.minutes)
    if (!name.trim()) return setError('Add your name.')
    if (!minutes) return setError('Enter how many minutes a day you can practice.')
    setBusy(true)
    setError(null)
    try {
      await db.saveProfile({ name: name.trim(), level: level || null, ready_by: timeline.readyBy || null, minutes_per_day: minutes })
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section">
      <form onSubmit={submit} className="space-y-5">
        <h2 className="font-semibold">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <LevelSelect value={level} onChange={setLevel} />
        </div>
        <TimelineFields readyBy={timeline.readyBy} minutes={timeline.minutes} onChange={setTimeline} />
        {error && <InlineError>{error}</InlineError>}
        <div className="flex items-center gap-3">
          <Button type="submit" busy={busy}>
            Save changes
          </Button>
          {saved && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-accent-text">
              <Check aria-hidden className="size-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  )
}

// Only needed for the Home Screen app on a phone, which can't open the emailed sign-in link.
function PasswordForm() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) return setError('Use at least 6 characters.')
    setBusy(true)
    setError(null)
    try {
      await db.setPassword(password)
      setPassword('')
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section">
      <form onSubmit={submit}>
        <h2 className="font-semibold">Password</h2>
        <p className="mt-1 text-sm text-muted">
          Optional. Set one to sign in on the Home Screen app, which can't open the emailed link.
        </p>
        <div className="mt-4 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setSaved(false)
              }}
            />
          </div>
          <Button type="submit" busy={busy} className="min-h-12">
            Save
          </Button>
        </div>
        {error && (
          <div className="mt-2">
            <InlineError>{error}</InlineError>
          </div>
        )}
        {saved && (
          <p role="status" className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent-text">
            <Check aria-hidden className="size-4" /> Saved. Use it with "Use a password instead" on the sign-in page.
          </p>
        )}
      </form>
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
    </div>
  )
}
