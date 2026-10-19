// In-memory backend for VITE_MOCK=1. Writes are kept in sessionStorage so a page reload
// keeps them. Start a fresh scenario with ?mock=full (default), ?mock=new (signed in,
// nothing filled in yet) or ?mock=signedout.

import type { Backend } from '../lib/db'
import type { Answer, Company, Profile, Role, SessionUser, Target, TargetInput } from '../lib/types'
import * as fx from './fixtures'

interface State {
  user: SessionUser | null
  profile: Profile | null
  targets: Target[]
  companies: Company[]
  roles: Role[]
  answers: Answer[]
}

const KEY = 'mock-state'

function initial(scenario: string): State {
  const base = { companies: fx.companies, roles: fx.roles, answers: [] as Answer[] }
  if (scenario === 'signedout') return { ...base, user: null, profile: null, targets: [] }
  if (scenario === 'new') return { ...base, user: fx.MOCK_USER, profile: null, targets: [] }
  return { ...base, user: fx.MOCK_USER, profile: fx.profile, targets: fx.targets, answers: fx.answers }
}

function load(): State {
  const scenario = new URLSearchParams(window.location.search).get('mock')
  if (scenario) {
    const s = initial(scenario)
    save(s)
    return s
  }
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      return { ...initial('full'), ...saved, answers: saved.answers ?? [] }
    }
  } catch {
    // Storage unavailable: fall through to the default scenario.
  }
  return initial('full')
}

function save(s: State) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Ignore; state just won't survive a reload.
  }
}

let state = load()
const listeners = new Set<(u: SessionUser | null) => void>()
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const commit = () => save(state)
const own = (rows: { user_id: string }[]) => !!state.user && rows.length > 0

function ensure<T extends { id: string; name: string }>(list: T[], name: string, prefix: string): string {
  const found = list.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
  if (found) return found.id
  const id = `${prefix}-${crypto.randomUUID()}`
  list.push({ id, name: name.trim() } as T)
  return id
}

function resolve(input: TargetInput) {
  return {
    company_id: ensure(state.companies, input.company, 'c'),
    role_id: ensure(state.roles, input.role, 'r'),
    job_description: input.job_description,
  }
}

function assertUnique(company_id: string, role_id: string, exceptId?: string) {
  if (state.targets.some((t) => t.company_id === company_id && t.role_id === role_id && t.id !== exceptId)) {
    throw new Error('You already have that company and role as a target.')
  }
}

function requireUser(): SessionUser {
  if (!state.user) throw new Error('You are signed out. Sign in again to continue.')
  return state.user
}

const topicById = (id: number) => fx.topics.find((t) => t.id === id)!
const companyName = (id: string | null) => state.companies.find((c) => c.id === id)?.name ?? null

export const mockBackend: Backend = {
  async getUser() {
    return state.user
  },
  onAuthChange(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  async sendMagicLink(email) {
    await wait(400)
    if (!email.includes('@')) throw new Error('Enter a valid email address.')
    // Mock mode signs in straight away when the link is "clicked" (see SignIn).
  },
  async signOut() {
    state = { ...state, user: null }
    commit()
    listeners.forEach((l) => l(null))
  },

  async getProfile() {
    await wait()
    requireUser()
    return state.profile
  },
  async saveProfile(input) {
    await wait()
    const user = requireUser()
    const prev: Profile = state.profile ?? {
      user_id: user.id,
      name: null,
      level: null,
      ready_by: null,
      minutes_per_day: null,
      resume_path: null,
      resume_name: null,
      updated_at: '',
    }
    state.profile = { ...prev, ...input, updated_at: new Date().toISOString() }
    commit()
  },
  async uploadResume(file) {
    const user = requireUser()
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
    await mockBackend.saveProfile({ resume_path: `${user.id}/resume.${ext}`, resume_name: file.name })
  },
  async resumeUrl() {
    return null
  },

  async listTargets() {
    await wait()
    requireUser()
    return state.targets.map((t) => {
      const r = fx.researchProfiles.find((p) => p.company_id === t.company_id && p.role_id === t.role_id)
      return {
        ...t,
        company: companyName(t.company_id) ?? '',
        role: state.roles.find((x) => x.id === t.role_id)?.name ?? '',
        research: r ? { id: r.id, status: r.status, confidence: r.confidence, researched_at: r.researched_at } : null,
      }
    })
  },
  async addTarget(input) {
    await wait()
    const user = requireUser()
    const row = resolve(input)
    assertUnique(row.company_id, row.role_id)
    state.targets.push({ id: crypto.randomUUID(), user_id: user.id, created_at: new Date().toISOString(), ...row })
    commit()
  },
  async updateTarget(id, input) {
    await wait()
    const row = resolve(input)
    assertUnique(row.company_id, row.role_id, id)
    state.targets = state.targets.map((t) => (t.id === id ? { ...t, ...row } : t))
    commit()
  },
  async removeTarget(id) {
    await wait()
    state.targets = state.targets.filter((t) => t.id !== id)
    commit()
  },
  async listCompanyNames() {
    return state.companies.map((c) => c.name).sort()
  },
  async listRoleNames() {
    return state.roles.map((r) => r.name).sort()
  },

  async listTopics() {
    return fx.topics
  },
  async getFocusTopics() {
    await wait()
    if (!own(state.targets)) return []
    return [...fx.focusTopics].sort((a, b) => b.weight - a.weight).map((f) => ({ ...f, topic: topicById(f.topic_id) }))
  },
  async getHistory() {
    await wait()
    if (!own(state.targets)) return []
    return fx.questions.map((q) => {
      const attempts = state.answers.filter((a) => a.question_id === q.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
      const latest = attempts[attempts.length - 1]
      const graded = [...attempts].reverse().find((a) => fx.grades.some((g) => g.answer_id === a.id))
      const grade = graded ? fx.grades.find((g) => g.answer_id === graded.id)! : null
      return {
        id: q.id,
        topic_id: q.topic_id,
        company_id: q.company_id,
        company: companyName(q.company_id),
        format: q.format,
        difficulty: q.difficulty,
        minutes: q.minutes,
        prompt: q.prompt,
        set_date: q.set_date,
        reason: q.reason,
        created_at: q.created_at,
        answer_id: latest?.id ?? null,
        answer_status: latest?.status ?? null,
        answered_at: latest?.created_at ?? null,
        seconds_spent: latest?.seconds_spent ?? null,
        score: grade?.score ?? null,
        graded_at: grade?.graded_at ?? null,
        attempts: attempts.length,
        answered_ats: attempts.map((a) => a.created_at),
        topic: topicById(q.topic_id),
      }
    })
  },
  async getQuestion(id) {
    await wait()
    const q = fx.questions.find((x) => x.id === id)
    return q ? { ...q, topic: topicById(q.topic_id), company: companyName(q.company_id) } : null
  },
  async getResearch(companyId, roleId) {
    await wait()
    const profile = fx.researchProfiles.find((p) => p.company_id === companyId && p.role_id === roleId)
    if (!profile) return null
    const rounds = fx.profileRounds
      .filter((r) => r.profile_id === profile.id)
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        ...r,
        topics: fx.roundTopics
          .filter((l) => l.round_id === r.id)
          .map((l) => ({ ...l, topic: topicById(l.topic_id) }))
          .sort((a, b) => b.weight - a.weight),
      }))
    return { profile, rounds, sources: fx.profileSources.filter((s) => s.profile_id === profile.id) }
  },

  async submitAnswer(questionId, body, secondsSpent, code) {
    await wait()
    const user = requireUser()
    if (!body.trim()) throw new Error('Write an answer first.')
    state.answers.push({
      id: crypto.randomUUID(),
      user_id: user.id,
      question_id: questionId,
      body,
      seconds_spent: secondsSpent,
      status: 'pending',
      language: code?.language ?? null,
      run_result: code?.run_result ?? null,
      created_at: new Date().toISOString(),
    })
    commit()
  },
  async getAnswers(questionId) {
    await wait()
    return state.answers
      .filter((a) => a.question_id === questionId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({ ...a, grade: fx.grades.find((g) => g.answer_id === a.id) ?? null }))
  },
}

// Used by the sign-in page in mock mode to stand in for clicking the emailed link.
export function mockCompleteSignIn(email: string) {
  state = { ...state, user: { ...fx.MOCK_USER, email } }
  commit()
  listeners.forEach((l) => l(state.user))
}
