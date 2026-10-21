// Form pieces shared by onboarding, Targets and Profile.

import { useEffect, useId, useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { db } from '../lib/db'
import { LEVELS } from '../lib/constants'
import type { TargetInput } from '../lib/types'
import { Button, InlineError, SelectField, TextArea, TextField } from './ui'

export function LevelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SelectField label="Level you're aiming for" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a level</option>
      {LEVELS.map((l) => (
        <option key={l}>{l}</option>
      ))}
    </SelectField>
  )
}

export function TargetFields({
  value,
  onChange,
  suggestions,
}: {
  value: TargetInput
  onChange: (v: TargetInput) => void
  suggestions: { companies: string[]; roles: string[] }
}) {
  const id = useId()
  const set = (patch: Partial<TargetInput>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Company"
          required
          list={`${id}-companies`}
          placeholder="e.g. Databricks"
          value={value.company}
          onChange={(e) => set({ company: e.target.value })}
        />
        <TextField
          label="Role"
          required
          list={`${id}-roles`}
          placeholder="e.g. Machine Learning Engineer"
          hint="Saved as a standard title: Senior ML Engineer becomes Machine Learning Engineer."
          value={value.role}
          onChange={(e) => set({ role: e.target.value })}
        />
      </div>
      <TextArea
        label={
          <>
            Job posting <span className="font-normal text-muted">(optional)</span>
          </>
        }
        hint="Paste the full posting. It shifts your plan toward what this team asks for."
        rows={4}
        value={value.job_description ?? ''}
        onChange={(e) => set({ job_description: e.target.value })}
      />
      <datalist id={`${id}-companies`}>
        {suggestions.companies.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id={`${id}-roles`}>
        {suggestions.roles.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  )
}

/** Shows the current resume (with a link when one can be made) and lets the user upload or replace it. */
export function ResumeUpload({
  name,
  path,
  onUploaded,
}: {
  name: string | null
  path: string | null
  onUploaded: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(null)
    if (path) db.resumeUrl(path).then(setUrl).catch(() => setUrl(null))
  }, [path])

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      await db.uploadResume(file)
      onUploaded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {name && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
          <FileText aria-hidden className="size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="block truncate font-medium text-accent-text underline-offset-2 hover:underline">
                {name}
              </a>
            ) : (
              <span className="block truncate font-medium">{name}</span>
            )}
            <span className="text-xs text-muted">Uploaded</span>
          </div>
        </div>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void upload(f)
        }}
      />
      <Button variant="secondary" busy={busy} onClick={() => input.current?.click()}>
        <Upload aria-hidden className="size-4" />
        {name ? 'Replace resume' : 'Upload resume'}
      </Button>
      {error && <InlineError>{error}</InlineError>}
    </div>
  )
}

export function TimelineFields({
  readyBy,
  minutes,
  onChange,
}: {
  readyBy: string
  minutes: string
  onChange: (v: { readyBy: string; minutes: string }) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Ready by"
        type="date"
        value={readyBy}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => onChange({ readyBy: e.target.value, minutes })}
        hint="When you want to be interview-ready."
      />
      <TextField
        label="Minutes per day"
        type="number"
        inputMode="numeric"
        min={10}
        max={240}
        step={5}
        required
        value={minutes}
        onChange={(e) => onChange({ readyBy, minutes: e.target.value })}
        hint="Your daily set is sized to fit this."
      />
    </div>
  )
}
