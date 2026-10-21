// Instant grading on the Mac mini. Every few seconds it asks Supabase how many answers are
// waiting (just a number, via the public key). When one is, it runs Claude Code headless with
// worker/grade-prompt.md, which grades them through the Supabase MCP and writes the grades back.
// Claude Code is signed in with the owner's Max plan, so no API key is used.
//
// Run: node worker/grader.mjs   (worker/setup.sh installs it as a background service)

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
const RUN_TIMEOUT_MS = 15 * 60 * 1000
const LOG = join(HERE, 'grader.log')

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`
  console.log(line)
  try {
    appendFileSync(LOG, line + '\n')
  } catch {
    // Console output is enough.
  }
}

async function pendingCount() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pending_grades`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new Error(`pending_grades: HTTP ${res.status} ${await res.text()}`)
  return Number(await res.json())
}

function runClaude() {
  const prompt = readFileSync(join(HERE, 'grade-prompt.md'), 'utf8')
  const args = [
    '-p',
    prompt,
    '--allowedTools',
    'Read,mcp__supabase__execute_sql',
    '--output-format',
    'text',
  ]
  return new Promise((resolve) => {
    const child = spawn(CLAUDE, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    const timer = setTimeout(() => {
      log('grading run took over 15 minutes, stopping it')
      child.kill('SIGTERM')
    }, RUN_TIMEOUT_MS)
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  log(`grader started, checking every ${POLL_MS / 1000}s`)
  let backoff = 0
  for (;;) {
    try {
      const before = await pendingCount()
      if (before === 0) backoff = 0
      if (before > 0) {
        log(`${before} answer(s) waiting, grading`)
        const started = Date.now()
        const { ok, out } = await runClaude()
        const after = await pendingCount()
        log(`${ok ? 'done' : 'failed'} in ${Math.round((Date.now() - started) / 1000)}s, ${after} still waiting\n${out}`)
        // If nothing got graded, something is wrong (signed out, MCP not connected, limits):
        // wait longer before trying again instead of burning usage.
        backoff = after >= before ? Math.min((backoff || 60_000) * 2, 30 * 60_000) : 0
        if (backoff) log(`no progress, retrying in ${backoff / 60_000} min`)
      }
    } catch (e) {
      log(`check failed: ${e.message}`)
    }
    await sleep(backoff || POLL_MS)
  }
}

main()
