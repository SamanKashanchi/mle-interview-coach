import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Crosshair, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useAsync } from '../../lib/useAsync'
import type { TargetInput, TargetView } from '../../lib/types'
import { Button, Card, EmptyState, ErrorState, InlineError, PageHeader, SkeletonList } from '../../components/ui'
import { TargetFields } from '../../components/forms'
import { cleanTarget, emptyTarget, useSuggestions } from '../../lib/formHelpers'
import { ResearchStatusBadge } from './status'

export default function Targets() {
  const { data, error, loading, reload } = useAsync(() => db.listTargets(), [])
  const [adding, setAdding] = useState(false)
  const suggestions = useSuggestions()

  const header = (
    <PageHeader
      title="Targets"
      subtitle="The companies and roles you're preparing for."
      action={
        !adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" /> Add target
          </Button>
        )
      }
    />
  )

  if (error) return <>{header}<ErrorState message={error} onRetry={reload} /></>
  if (loading && !data) return <>{header}<SkeletonList rows={2} /></>
  const targets = data ?? []

  return (
    <>
      {header}
      {adding && (
        <TargetForm
          title="New target"
          initial={emptyTarget()}
          suggestions={suggestions}
          submitLabel="Add target"
          onCancel={() => setAdding(false)}
          onSave={async (t) => {
            await db.addTarget(t)
            setAdding(false)
            reload()
          }}
        />
      )}
      {targets.length === 0 && !adding ? (
        <EmptyState
          icon={<Crosshair className="size-6" />}
          title="No targets yet"
          action={<Button onClick={() => setAdding(true)}>Add your first target</Button>}
        >
          Add a company and role. Claude researches how they interview and builds your plan from it.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {targets.map((t) => (
            <TargetCard key={t.id} t={t} suggestions={suggestions} onChanged={reload} canRemove={targets.length > 1} />
          ))}
        </ul>
      )}
      {targets.some((t) => t.research?.status !== 'done') && (
        <p className="mt-6 text-sm text-muted">
          Pending targets get researched the next time Claude runs research from the project chat. Their topics join your plan after that.
        </p>
      )}
    </>
  )
}

function TargetCard({
  t,
  suggestions,
  onChanged,
  canRemove,
}: {
  t: TargetView
  suggestions: { companies: string[]; roles: string[] }
  onChanged: () => void
  canRemove: boolean
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-remove'>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode === 'edit') {
    return (
      <li>
        <TargetForm
          title={`Edit ${t.company}`}
          initial={{ company: t.company, role: t.role, job_description: t.job_description ?? '' }}
          suggestions={suggestions}
          submitLabel="Save changes"
          onCancel={() => setMode('view')}
          onSave={async (input) => {
            await db.updateTarget(t.id, input)
            setMode('view')
            onChanged()
          }}
        />
      </li>
    )
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await db.removeTarget(t.id)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-surface">
      <Link to={`/targets/${t.id}`} className="group flex items-center gap-4 rounded-t-2xl p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{t.company}</p>
          <p className="text-muted">{t.role}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ResearchStatusBadge research={t.research} />
            {t.job_description && <span className="text-xs text-faint">Posting added</span>}
          </div>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
      </Link>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2 sm:px-4">
        {mode === 'confirm-remove' ? (
          <>
            <span className="px-2 text-sm">Remove {t.company}?</span>
            <Button variant="danger" busy={busy} onClick={remove} className="min-h-9">
              Remove
            </Button>
            <Button variant="ghost" onClick={() => setMode('view')} className="min-h-9">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setMode('edit')} className="min-h-9">
              <Pencil aria-hidden className="size-4" /> Edit
            </Button>
            {canRemove && (
              <Button variant="ghost" onClick={() => setMode('confirm-remove')} className="min-h-9">
                <Trash2 aria-hidden className="size-4" /> Remove
              </Button>
            )}
          </>
        )}
        {error && <InlineError>{error}</InlineError>}
      </div>
    </li>
  )
}

function TargetForm({
  title,
  initial,
  suggestions,
  submitLabel,
  onSave,
  onCancel,
}: {
  title: string
  initial: TargetInput
  suggestions: { companies: string[]; roles: string[] }
  submitLabel: string
  onSave: (t: TargetInput) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = cleanTarget(value)
    if (!t.company || !t.role) {
      setError('Add both a company and a role.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(t)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card className="mb-3 border-accent/40">
      <form onSubmit={submit} className="space-y-5">
        <h2 className="font-semibold">{title}</h2>
        <TargetFields value={value} onChange={setValue} suggestions={suggestions} />
        {error && <InlineError>{error}</InlineError>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  )
}
