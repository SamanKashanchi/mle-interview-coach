import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import type { TargetInput } from '../lib/types'

/** Existing company and role names, for autocomplete. */
export function useSuggestions() {
  const [companies, setCompanies] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  useEffect(() => {
    db.listCompanyNames().then(setCompanies).catch(() => {})
    db.listRoleNames().then(setRoles).catch(() => {})
  }, [])
  return { companies, roles }
}

export const emptyTarget = (): TargetInput => ({ company: '', role: '', job_description: '' })

export const cleanTarget = (t: TargetInput): TargetInput => ({
  company: t.company.trim(),
  role: t.role.trim(),
  job_description: t.job_description?.trim() || null,
})

export function parseMinutes(v: string): number | null {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
