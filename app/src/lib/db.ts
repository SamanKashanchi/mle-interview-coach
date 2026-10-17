// The one place the app talks to the database. Pages call these functions and never
// touch supabase directly. With VITE_MOCK=1 the same functions run on fixture data.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mockBackend } from '../mock/backend'
import type {
  AnswerView,
  FocusTopic,
  Grade,
  FocusTopicView,
  HistoryItem,
  HistoryItemView,
  Profile,
  ProfileInput,
  ProfileRound,
  ProfileSource,
  Question,
  QuestionView,
  ResearchDetail,
  ResearchProfile,
  RoundTopic,
  SessionUser,
  Target,
  TargetInput,
  TargetView,
  Topic,
} from './types'

export interface Backend {
  getUser(): Promise<SessionUser | null>
  onAuthChange(cb: (user: SessionUser | null) => void): () => void
  sendMagicLink(email: string): Promise<void>
  signOut(): Promise<void>

  getProfile(): Promise<Profile | null>
  saveProfile(input: ProfileInput): Promise<void>
  uploadResume(file: File): Promise<void>
  resumeUrl(path: string): Promise<string | null>

  listTargets(): Promise<TargetView[]>
  addTarget(input: TargetInput): Promise<void>
  updateTarget(id: string, input: TargetInput): Promise<void>
  removeTarget(id: string): Promise<void>
  listCompanyNames(): Promise<string[]>
  listRoleNames(): Promise<string[]>

  listTopics(): Promise<Topic[]>
  getFocusTopics(): Promise<FocusTopicView[]>
  /** Every question the user has been given, oldest first, with its latest attempt and grade. */
  getHistory(): Promise<HistoryItemView[]>
  getQuestion(id: string): Promise<QuestionView | null>
  getResearch(companyId: string, roleId: string): Promise<ResearchDetail | null>

  submitAnswer(questionId: string, body: string, secondsSpent: number | null): Promise<void>
  /** Every attempt at one question, newest first, each with its grade if it has one. */
  getAnswers(questionId: string): Promise<AnswerView[]>
}

export const isMock = import.meta.env.VITE_MOCK === '1'

let client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing Supabase settings. Copy app/.env.example to app/.env.local.')
    client = createClient(url, key)
  }
  return client
}

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === '23505') throw new Error('You already have that company and role as a target.')
    throw new Error(res.error.message)
  }
  return res.data
}

async function uid(): Promise<string> {
  const user = await realBackend.getUser()
  if (!user) throw new Error('You are signed out. Sign in again to continue.')
  return user.id
}

const toUser = (u: { id: string; email?: string } | null | undefined): SessionUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null

let topicCache: Promise<Topic[]> | null = null

const PROFILE_COLS = 'user_id, name, level, ready_by, minutes_per_day, resume_path, resume_name, updated_at'
const QUESTION_COLS = 'id, user_id, topic_id, company_id, format, difficulty, minutes, prompt, rubric, set_date, reason, created_at, companies(name)'

type Named = { name: string } | null
type QuestionRow = Question & { companies: Named }

async function withTopics(rows: QuestionRow[]): Promise<QuestionView[]> {
  const topics = await realBackend.listTopics()
  return rows.map(({ companies, ...q }) => ({
    ...q,
    company: companies?.name ?? null,
    topic: topics.find((t) => t.id === q.topic_id)!,
  }))
}

async function ensureIds(input: TargetInput) {
  const [company, role] = await Promise.all([
    sb().rpc('ensure_company', { p_name: input.company.trim() }),
    sb().rpc('ensure_role', { p_name: input.role.trim() }),
  ])
  return { company_id: check(company) as string, role_id: check(role) as string }
}

export const realBackend: Backend = {
  async getUser() {
    const { data } = await sb().auth.getSession()
    return toUser(data.session?.user)
  },
  onAuthChange(cb) {
    const { data } = sb().auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)))
    return () => data.subscription.unsubscribe()
  },
  async sendMagicLink(email) {
    const { error } = await sb().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) throw new Error(error.message)
  },
  async signOut() {
    await sb().auth.signOut()
  },

  async getProfile() {
    const id = await uid()
    return check(await sb().from('profiles').select(PROFILE_COLS).eq('user_id', id).maybeSingle()) as Profile | null
  },
  async saveProfile(input) {
    const id = await uid()
    check(await sb().from('profiles').upsert({ user_id: id, ...input, updated_at: new Date().toISOString() }))
  },
  async uploadResume(file) {
    const id = await uid()
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
    const path = `${id}/resume.${ext}`
    const { error } = await sb().storage.from('resumes').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    await realBackend.saveProfile({ resume_path: path, resume_name: file.name })
  },
  async resumeUrl(path) {
    const { data } = await sb().storage.from('resumes').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  },

  async listTargets() {
    const id = await uid()
    const rows = check(
      await sb()
        .from('targets')
        .select('id, user_id, company_id, role_id, job_description, created_at, companies(name), roles(name)')
        .eq('user_id', id)
        .order('created_at'),
    ) as unknown as (Target & { companies: Named; roles: Named })[]
    if (!rows.length) return []
    const research = check(
      await sb()
        .from('research_profiles')
        .select('id, company_id, role_id, status, confidence, researched_at')
        .in('company_id', [...new Set(rows.map((r) => r.company_id))]),
    ) as Pick<ResearchProfile, 'id' | 'company_id' | 'role_id' | 'status' | 'confidence' | 'researched_at'>[]
    return rows.map(({ companies, roles, ...t }) => {
      const r = research.find((p) => p.company_id === t.company_id && p.role_id === t.role_id)
      return {
        ...t,
        company: companies?.name ?? '',
        role: roles?.name ?? '',
        research: r ? { id: r.id, status: r.status, confidence: r.confidence, researched_at: r.researched_at } : null,
      }
    })
  },
  async addTarget(input) {
    const id = await uid()
    const ids = await ensureIds(input)
    check(await sb().from('targets').insert({ user_id: id, ...ids, job_description: input.job_description }))
  },
  async updateTarget(targetId, input) {
    const ids = await ensureIds(input)
    check(await sb().from('targets').update({ ...ids, job_description: input.job_description }).eq('id', targetId))
  },
  async removeTarget(targetId) {
    check(await sb().from('targets').delete().eq('id', targetId))
  },
  async listCompanyNames() {
    return (check(await sb().from('companies').select('name').order('name')) as { name: string }[]).map((r) => r.name)
  },
  async listRoleNames() {
    return (check(await sb().from('roles').select('name').order('name')) as { name: string }[]).map((r) => r.name)
  },

  listTopics() {
    topicCache ??= (async () =>
      check(await sb().from('topics').select('id, name, category, description').order('id')) as Topic[])()
    topicCache.catch(() => (topicCache = null))
    return topicCache
  },
  async getFocusTopics() {
    const id = await uid()
    const [rows, topics] = await Promise.all([
      sb().from('focus_topics').select('*').eq('user_id', id).order('weight', { ascending: false }),
      realBackend.listTopics(),
    ])
    return (check(rows) as FocusTopic[]).map((f) => ({ ...f, topic: topics.find((t) => t.id === f.topic_id)! }))
  },
  async getHistory() {
    const id = await uid()
    const [rows, topics] = await Promise.all([
      sb().from('question_history').select('*').eq('user_id', id).order('created_at').order('id'),
      realBackend.listTopics(),
    ])
    return (check(rows) as HistoryItem[]).map((h) => ({
      ...h,
      score: h.score == null ? null : Number(h.score),
      answered_ats: h.answered_ats ?? [],
      topic: topics.find((t) => t.id === h.topic_id)!,
    }))
  },
  async getQuestion(questionId) {
    const row = check(await sb().from('questions').select(QUESTION_COLS).eq('id', questionId).maybeSingle()) as unknown as QuestionRow | null
    return row ? (await withTopics([row]))[0] : null
  },
  async getResearch(companyId, roleId) {
    const profile = check(
      await sb()
        .from('research_profiles')
        .select('id, company_id, role_id, status, summary, style_notes, level_notes, confidence, gaps, researched_at')
        .eq('company_id', companyId)
        .eq('role_id', roleId)
        .maybeSingle(),
    ) as ResearchProfile | null
    if (!profile) return null
    const [rounds, sources, topics] = await Promise.all([
      sb().from('profile_rounds').select('*').eq('profile_id', profile.id).order('position'),
      sb().from('profile_sources').select('*').eq('profile_id', profile.id),
      realBackend.listTopics(),
    ])
    const roundRows = check(rounds) as ProfileRound[]
    const links = roundRows.length
      ? (check(await sb().from('round_topics').select('*').in('round_id', roundRows.map((r) => r.id))) as RoundTopic[])
      : []
    return {
      profile,
      sources: check(sources) as ProfileSource[],
      rounds: roundRows.map((r) => ({
        ...r,
        topics: links
          .filter((l) => l.round_id === r.id)
          .map((l) => ({ ...l, topic: topics.find((t) => t.id === l.topic_id)! }))
          .sort((a, b) => b.weight - a.weight),
      })),
    }
  },

  async submitAnswer(questionId, body, secondsSpent) {
    const id = await uid()
    check(await sb().from('answers').insert({ user_id: id, question_id: questionId, body, seconds_spent: secondsSpent }))
  },
  async getAnswers(questionId) {
    const rows = check(
      await sb()
        .from('answers')
        .select('id, user_id, question_id, body, seconds_spent, status, created_at, grades(*)')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false }),
    ) as unknown as (Omit<AnswerView, 'grade'> & { grades: Grade | Grade[] | null })[]
    // grades is one-to-one (answer_id is its primary key), but normalize either shape.
    return rows.map(({ grades, ...a }) => ({ ...a, grade: (Array.isArray(grades) ? grades[0] : grades) ?? null }))
  },
}

export const db: Backend = isMock ? mockBackend : realBackend
