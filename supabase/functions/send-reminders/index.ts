// Sends push reminders. Two callers:
//   - pg_cron, every 5 minutes, with the x-cron-secret header: sends every reminder that's due
//     (claim_due_reminders() decides which, and marks them sent for today).
//   - the portal's "Send a test" button, with the user's own session: sends one test notification
//     to that user's devices.
// Devices whose subscription is gone (404/410 from the push service) are removed.
//
// Secrets live in Supabase Vault (vapid_private_key, reminders_cron_secret), read through
// reminder_secrets(), so nothing secret is in the repo or the function's settings.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = 'BGfh57zPOr9S8d99ndLuDSTocyQnI3WQbYaGFEZqVgrLgoTg70rqqD56qa1lJjI3cNxuvYGDBFnP9Aj0_U_D8xQ'
const APP_URL = 'https://mle-interview-coach.vercel.app'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

let cronSecret: string | null = null
async function loadSecrets() {
  if (cronSecret) return
  const { data, error } = await admin.rpc('reminder_secrets').single<{ vapid_private_key: string; cron_secret: string }>()
  if (error || !data?.vapid_private_key) throw new Error(`reminder secrets missing: ${error?.message ?? ''}`)
  webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, data.vapid_private_key)
  cronSecret = data.cron_secret
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  user_id: string
  title: string
  body: string
  url: string
}

async function send(messages: Message[]) {
  let sent = 0
  let failed = 0
  for (const m of messages) {
    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', m.user_id)
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url })
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60,
          urgency: 'high',
        })
        sent++
      } catch (e) {
        failed++
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
        console.error(`push to ${s.id} failed: ${status ?? ''} ${(e as Error).message}`)
      }
    }
  }
  return { messages: messages.length, sent, failed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    await loadSecrets()
    // Scheduled run.
    if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
      const { data, error } = await admin.rpc('claim_due_reminders')
      if (error) throw error
      return json(await send((data ?? []) as Message[]))
    }

    // Test from the portal: the caller's own devices only.
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } }
    if (!auth.user) return json({ error: 'not signed in' }, 401)
    const result = await send([
      {
        user_id: auth.user.id,
        title: 'Reminders are on',
        body: "This is what a reminder looks like. Tap to open today's questions.",
        url: '/',
      },
    ])
    return json(result)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
