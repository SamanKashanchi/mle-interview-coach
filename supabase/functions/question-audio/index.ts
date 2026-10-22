// Lets the Mac mini worker add spoken versions of questions (worker/tts.mjs). Two calls, both with
// the worker's key in the x-worker-token header (only its sha256 is stored, in worker_tokens):
//   GET               questions from the last 3 days that have no audio yet: id, title, prompt
//   PUT ?id=<uuid>    body is the M4A file: stored as question-audio/<user id>/<id>.m4a and saved
//                     in questions.audio_path, so the portal plays it
// Deployed with verify_jwt off: the worker has no user session, the key is the check.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const BUCKET = 'question-audio'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function authorized(req: Request) {
  const token = req.headers.get('x-worker-token')
  if (!token || token.length < 32) return false
  const { data } = await admin.from('worker_tokens').select('hash').eq('hash', await sha256(token)).maybeSingle()
  return data != null
}

Deno.serve(async (req) => {
  if (!(await authorized(req))) return json({ error: 'not authorized' }, 401)

  if (req.method === 'GET') {
    const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString()
    const { data, error } = await admin
      .from('questions')
      .select('id, prompt, topics(name)')
      .is('audio_path', null)
      .gt('created_at', since)
      .order('created_at')
      .limit(20)
    if (error) return json({ error: error.message }, 500)
    return json(
      (data ?? []).map((q) => ({ id: q.id, title: (q.topics as unknown as { name: string } | null)?.name ?? '', prompt: q.prompt })),
    )
  }

  if (req.method === 'PUT') {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const { data: q } = await admin.from('questions').select('user_id').eq('id', id).maybeSingle()
    if (!q) return json({ error: 'question not found' }, 404)
    const audio = new Uint8Array(await req.arrayBuffer())
    if (!audio.length) return json({ error: 'empty body' }, 400)
    const path = `${q.user_id}/${id}.m4a`
    const up = await admin.storage.from(BUCKET).upload(path, audio, { contentType: 'audio/mp4', upsert: true })
    if (up.error) return json({ error: up.error.message }, 500)
    const { error } = await admin.from('questions').update({ audio_path: path }).eq('id', id)
    if (error) return json({ error: error.message }, 500)
    return json({ path })
  }

  return json({ error: 'use GET or PUT' }, 405)
})
