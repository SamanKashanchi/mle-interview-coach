// The coach's background worker on the Mac mini. Every few seconds it asks Supabase what needs
// doing (just counts, via the public key) and runs Claude Code headless for each job:
//   grade      answers waiting for a grade               -> prompts/grade.md
//   research   targets whose company + role has no research yet -> prompts/research.md
//   questions  no question set for today yet (from QUESTIONS_HOUR, 5 AM local) -> prompts/questions.md
// Claude Code is signed in with the owner's Max plan, so no API key is used. Grading runs alongside
// the other jobs; questions wait for research so a new target is in that day's set.
//
// Run: node worker/worker.mjs   (worker/setup.sh installs it as a background service)

import { spawn } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// Public values, the same ones the web app ships with (app/.env.production).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uwmenprzfrtlqujmvlyq.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_KOWlpr-QZanjscnHSYsygg_8IRgOFRO'

const CLAUDE = process.env.CLAUDE_BIN || 'claude'
const POLL_MS = Number(process.env.POLL_SECONDS || 10) * 1000
const QUESTIONS_HOUR = Number(process.env.QUESTIONS_HOUR || 5)
const LOG = join(HERE, 'worker.log')

const DB = 'mcp__supabase__execute_sql'
const JOBS = {
  // transcribe.mjs: Whisper on this Mac, for voice answers.
  grade: { tools: ['Read', 'Bash(node worker/transcribe.mjs:*)', DB], timeoutMin: 20 },
  research: { tools: ['Read', 'WebSearch', 'WebFetch', DB], timeoutMin: 45 },
  questions: {
    // Write + python3 + run-sql.mjs: to check expected outputs by running a reference solution.
    tools: ['Read', 'Write', 'Bash(python3:*)', 'Bash(node worker/run-sql.mjs:*)', DB],
    timeoutMin: 45,
  },
}
const state = Object.fromEntries(Object.keys(JOBS).map((k) => [k, { running: false, retryAt: 0, backoff: 0 }]))

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`
  console.log(line)
  try {
    appendFileSync(LOG, line + '\n')
  } catch {
    // Console output is enough.
  }
}

/** The Mac's local date and hour, which is the owner's (questions.set_date is a local date). */
function localNow() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour: d.getHours() }
}

async function todo(today) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/worker_todo`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_today: today }),
  })
  if (!res.ok) throw new Error(`worker_todo: HTTP ${res.status} ${await res.text()}`)
  return await res.json()
}

function runClaude(job, today) {
  const prompt =
    `Today is ${today} (the owner's local date).\n\n` + readFileSync(join(HERE, 'prompts', `${job}.md`), 'utf8')
  const args = ['-p', prompt, '--allowedTools', JOBS[job].tools.join(','), '--output-format', 'text']
  return new Promise((resolve) => {
    const child = spawn(CLAUDE, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    const timer = setTimeout(() => {
      log(`${job}: run took over ${JOBS[job].timeoutMin} minutes, stopping it`)
      child.kill('SIGTERM')
    }, JOBS[job].timeoutMin * 60_000)
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, out: `could not start ${CLAUDE}: ${e.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, out: out.trim() })
    })
  })
}

async function run(job, before, today) {
  const s = state[job]
  s.running = true
  log(`${job}: ${before} to do, starting`)
  const started = Date.now()
  try {
    const { ok, out } = await runClaude(job, today)
    const after = (await todo(today))[job]
    log(`${job}: ${ok ? 'done' : 'failed'} in ${Math.round((Date.now() - started) / 1000)}s, ${after} left\n${out}`)
    // If nothing changed, something is wrong (signed out, MCP not connected, usage limits):
    // wait longer before trying again instead of burning usage.
    s.backoff = after >= before ? Math.min((s.backoff || 60_000) * 2, 30 * 60_000) : 0
    if (s.backoff) log(`${job}: no progress, retrying in ${s.backoff / 60_000} min`)
  } catch (e) {
    s.backoff = Math.min((s.backoff || 60_000) * 2, 30 * 60_000)
    log(`${job}: ${e.message}`)
  } finally {
    s.retryAt = Date.now() + s.backoff
    s.running = false
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  log(`worker started, checking every ${POLL_MS / 1000}s, questions from ${QUESTIONS_HOUR}:00`)
  for (;;) {
    try {
      const { date, hour } = localNow()
      const counts = await todo(date)
      const ready = (job) => counts[job] > 0 && !state[job].running && Date.now() >= state[job].retryAt
      for (const job of Object.keys(JOBS)) if (counts[job] === 0) state[job].backoff = 0

      if (ready('grade')) run('grade', counts.grade, date)
      if (ready('research') && !state.questions.running) run('research', counts.research, date)
      // Questions wait for research, unless research keeps failing: then today still gets a set.
      else if (
        ready('questions') &&
        hour >= QUESTIONS_HOUR &&
        !state.research.running &&
        (counts.research === 0 || state.research.backoff > 0)
      )
        run('questions', counts.questions, date)
    } catch (e) {
      log(`check failed: ${e.message}`)
    }
    await sleep(POLL_MS)
  }
}

main()
