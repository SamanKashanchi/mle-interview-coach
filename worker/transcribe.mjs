// Transcribes one voice answer on this Mac with Whisper (whisper.cpp, runs locally, no API) and
// prints the transcript. The grader calls it for answers that have audio but no transcript yet.
//
//   node worker/transcribe.mjs <audio url> [vocabulary hint]
//
// The hint (e.g. the question's topic and key terms) helps Whisper spell technical words.
// Needs ffmpeg and whisper-cli (brew install ffmpeg whisper-cpp) and the model that
// worker/setup.sh downloads into worker/models/.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const MODEL = process.env.WHISPER_MODEL || join(HERE, 'models', 'ggml-large-v3-turbo-q5_0.bin')
const WHISPER = process.env.WHISPER_BIN || 'whisper-cli'
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`could not start ${cmd}: ${e.message}`)))
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))))
  })
}

const [url, hint = ''] = process.argv.slice(2)
if (!url) {
  console.error('Usage: node worker/transcribe.mjs <audio url> [vocabulary hint]')
  process.exit(2)
}
if (!existsSync(MODEL)) {
  console.error(`Whisper model not found at ${MODEL}. Run ./worker/setup.sh to download it.`)
  process.exit(1)
}

const dir = join(HERE, 'tmp', randomUUID())
mkdirSync(dir, { recursive: true })
try {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} (the link may have expired)`)
  const input = join(dir, 'input')
  writeFileSync(input, Buffer.from(await res.arrayBuffer()))

  // Whisper wants 16 kHz mono WAV; the phone gives AAC (iPhone) or Opus (Chrome).
  const wav = join(dir, 'audio.wav')
  await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav])

  const args = ['-m', MODEL, '-f', wav, '-l', 'en', '-nt', '-np']
  if (hint) args.push('--prompt', hint.slice(0, 600))
  const text = (await run(WHISPER, args))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
  if (!text) throw new Error('Whisper returned no text (silent or empty recording?)')
  console.log(text)
} catch (e) {
  console.error(`transcription failed: ${e.message}`)
  process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
