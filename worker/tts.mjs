// Spoken questions: reads each new question aloud with Kokoro on this Mac (worker/tts/speak.py, no
// API, no Claude usage) and uploads it through the question-audio edge function, so the portal's
// Read aloud button plays a natural voice. worker.mjs runs speakNew() when worker_todo() counts
// questions without audio.

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const PYTHON = join(HERE, 'tts', 'venv', 'bin', 'python')
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const VOICE = process.env.TTS_VOICE || 'bf_emma' // Kokoro's British female voice
const TOKEN_FILE = join(HERE, '.worker-token')

/** Markdown prompt -> plain sentences worth hearing. Same rules as app/src/lib/speech.ts. */
export function speakableText(md) {
  return md
    .replace(/```[\s\S]*?(```|$)/g, '\n(Code block skipped.)\n')
    .split('\n')
    .filter((line) => !/^\s*\|/.test(line)) // table rows
    .join('\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*#{1,6}\s+(.*)$/gm, '$1.') // headings become a sentence
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '') // list markers
    .replace(/^\s*>\s?/gm, '')
    .replace(/(\*\*|__|\*|_|~~)(\S[\s\S]*?\S|\S)\1/g, '$2')
    .replace(/(\(Code block skipped\.\)\s*)+/g, '(Code block skipped.) ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`could not start ${cmd}: ${e.message}`)))
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))))
    child.stdin.end(input ?? '')
  })
}

/** Speaks text into an M4A file (AAC, mono, 48 kbps: about 360 KB a minute). */
export async function speakToFile(text, dir) {
  const wav = join(dir, 'speech.wav')
  const m4a = join(dir, 'speech.m4a')
  await run(PYTHON, [join(HERE, 'tts', 'speak.py'), wav, VOICE], text)
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', m4a])
  return readFileSync(m4a)
}

const failed = new Map() // question id -> tries, so a question that can't be spoken is skipped after 3

/** Speaks every question that needs audio. Returns how many were uploaded. */
export async function speakNew(supabaseUrl, log) {
  const token = readFileSync(TOKEN_FILE, 'utf8').trim()
  const fn = `${supabaseUrl}/functions/v1/question-audio`
  const headers = { 'x-worker-token': token }
  const res = await fetch(fn, { headers })
  if (!res.ok) throw new Error(`question-audio: HTTP ${res.status} ${await res.text()}`)
  const todo = (await res.json()).filter((q) => (failed.get(q.id) ?? 0) < 3)

  let done = 0
  for (const q of todo) {
    const dir = join(HERE, 'tmp', randomUUID())
    mkdirSync(dir, { recursive: true })
    const started = Date.now()
    try {
      const audio = await speakToFile(`${q.title}.\n${speakableText(q.prompt)}`, dir)
      const up = await fetch(`${fn}?id=${q.id}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'audio/mp4' }, body: audio })
      if (!up.ok) throw new Error(`upload: HTTP ${up.status} ${await up.text()}`)
      done++
      log(`audio: ${q.title} spoken in ${Math.round((Date.now() - started) / 1000)}s (${Math.round(audio.length / 1024)} KB)`)
    } catch (e) {
      failed.set(q.id, (failed.get(q.id) ?? 0) + 1)
      log(`audio: ${q.id} failed: ${e.message}`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  return done
}
