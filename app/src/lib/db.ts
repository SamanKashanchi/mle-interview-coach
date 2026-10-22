// The one place the app talks to the database. Pages call these functions and never
// touch supabase directly. With VITE_MOCK=1 the same functions run on fixture data.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mockBackend } from '../mock/backend'
import { audioExtension, VOICE_PLACEHOLDER } from './voice'
import { localDay } from './progress'
import type {
  Answer,
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
  PushSubscriptionInput,
  Question,
  QuestionRequest,
  QuestionRequestInput,
  QuestionView,
  Reminder,
  ReminderInput,
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
  /** Password sign-in, for the Home Screen app, which can't open the emailed link. */
  signInWithPassword(email: string, password: string): Promise<void>
  setPassword(password: string): Promise<void>
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

  submitAnswer(questionId: string, body: string, secondsSpent: number | null, code?: Pick<Answer, 'language' | 'run_result'>): Promise<void>
  /** A spoken answer: uploads the recording; the Mac mini worker transcribes it, then grades it. */
  submitVoiceAnswer(questionId: string, audio: Blob, secondsSpent: number | null): Promise<void>
  /** A short-lived link to play back a voice answer. */
  audioUrl(path: string): Promise<string | null>
  /** A short-lived link to the question's spoken version (questions.audio_path). */
  questionAudioUrl(path: string): Promise<string | null>
  /** Every attempt at one question, newest first, each with its grade if it has one. */
  getAnswers(questionId: string): Promise<AnswerView[]>

  listReminders(): Promise<Reminder[]>
  saveReminder(input: ReminderInput): Promise<void>
  removeReminder(id: string): Promise<void>
  /** Saves this device's push subscription (or refreshes it if it's already saved). */
  savePushSubscription(sub: PushSubscriptionInput): Promise<void>
  removePushSubscription(endpoint: string): Promise<void>
  /** Sends a test notification to every device the user has turned reminders on for. */
  sendTestPush(): Promise<{ sent: number; failed: number }>

  /** Asks the Mac mini worker for extra questions today. */
  requestQuestions(input: QuestionRequestInput): Promise<QuestionRequest>
  /** The newest request for today, to show its progress. */
  latestQuestionRequest(): Promise<QuestionRequest | null>
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
const REQUEST_COLS = 'id, set_date, count, formats, topic_ids, status, note, created_at, finished_at'
const QUESTION_COLS = 'id, user_id, topic_id, company_id, format, difficulty, minutes, prompt, rubric, set_date, reason, code, audio_path, created_at, companies(name)'

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
  async signInWithPassword(email, password) {
    const { error } = await sb().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  },
  async setPassword(password) {
    const { error } = await sb().auth.updateUser({ password })
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

  async submitAnswer(questionId, body, secondsSpent, code) {
    const id = await uid()
    check(await sb().from('answers').insert({ user_id: id, question_id: questionId, body, seconds_spent: secondsSpent, ...code }))
  },
  async submitVoiceAnswer(questionId, audio, secondsSpent) {
    const user = await uid()
    const answerId = crypto.randomUUID()
    const path = `${user}/${answerId}.${audioExtension(audio.type)}`
    const bucket = sb().storage.from('answer-audio')
    const { error } = await bucket.upload(path, audio, { contentType: audio.type || 'audio/mp4' })
    if (error) throw new Error(`Couldn't upload the recording: ${error.message}`)
    // The worker downloads it with this link, so it needs no secret. 30 days covers a Mac that's off for a while.
    const signed = await bucket.createSignedUrl(path, 30 * 24 * 3600)
    if (signed.error) throw new Error(signed.error.message)
    check(
      await sb().from('answers').insert({
        id: answerId,
        user_id: user,
        question_id: questionId,
        body: VOICE_PLACEHOLDER,
        seconds_spent: secondsSpent,
        audio_path: path,
        audio_url: signed.data.signedUrl,
      }),
    )
  },
  async audioUrl(path) {
    const { data } = await sb().storage.from('answer-audio').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  },
  async questionAudioUrl(path) {
    const { data } = await sb().storage.from('question-audio').createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  },
  async listReminders() {
    return check(await sb().from('reminders').select('id, at, timezone, kind, days, enabled, last_sent_on').order('at')) as Reminder[]
  },
  async saveReminder({ id, ...fields }) {
    if (id) check(await sb().from('reminders').update(fields).eq('id', id))
    else check(await sb().from('reminders').insert(fields))
  },
  async removeReminder(id) {
    check(await sb().from('reminders').delete().eq('id', id))
  },
  async savePushSubscription(sub) {
    check(await sb().from('push_subscriptions').upsert({ ...sub, user_id: await uid() }, { onConflict: 'endpoint' }))
  },
  async removePushSubscription(endpoint) {
    check(await sb().from('push_subscriptions').delete().eq('endpoint', endpoint))
  },
  async sendTestPush() {
    const { data, error } = await sb().functions.invoke('send-reminders', { body: { test: true } })
    if (error) throw new Error(error.message)
    return data as { sent: number; failed: number }
  },

  async requestQuestions(input) {
    const id = await uid()
    const { data, error } = await sb()
      .from('question_requests')
      .insert({ user_id: id, set_date: localDay(), ...input })
      .select(REQUEST_COLS)
      .single()
    if (error?.code === '23505') throw new Error('Your last request is still being written. Wait for it to finish.')
    if (error) throw new Error(error.message)
    return data as QuestionRequest
  },
  async latestQuestionRequest() {
    const id = await uid()
    return check(
      await sb()
        .from('question_requests')
        .select(REQUEST_COLS)
        .eq('user_id', id)
        .eq('set_date', localDay())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ) as QuestionRequest | null
  },
  async getAnswers(questionId) {
    const rows = check(
      await sb()
        .from('answers')
        .select('id, user_id, question_id, body, seconds_spent, status, language, run_result, audio_path, transcribed_at, created_at, grades(*)')
        .eq('question_id', questionId)
        .order('created_at', { ascending: false }),
    ) as unknown as (Omit<AnswerView, 'grade'> & { grades: Grade | Grade[] | null })[]
    // grades is one-to-one (answer_id is its primary key), but normalize either shape.
    return rows.map(({ grades, ...a }) => ({ ...a, grade: (Array.isArray(grades) ? grades[0] : grades) ?? null }))
  },
}

export const db: Backend = isMock ? mockBackend : realBackend
