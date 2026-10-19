// Runs code answers in the browser, in a worker per language so a slow or endless answer can be
// stopped without freezing the page. Python uses Pyodide; SQL uses PGlite (real Postgres).

import type { CodeLanguage, CodeSpec, RunResult, RunStatus } from '../types'
import type { RunRequest, WorkerMessage } from './protocol'

/** Per Run or Submit, once the runtime is loaded. */
export const TIME_LIMIT_MS = 10_000

const pyodideURL = () => new URL(`${import.meta.env.BASE_URL}pyodide/`, document.baseURI).href

interface Slot {
  worker: Worker
  ready: Promise<void>
}

const slots = new Map<CodeLanguage, Slot>()
const readyFlags = new Set<CodeLanguage>()
let nextId = 1

function spawn(language: CodeLanguage): Slot {
  const worker =
    language === 'python'
      ? new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
      : new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module' })
  const ready = new Promise<void>((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      if (e.data.type === 'ready') resolve()
      else if (e.data.type === 'load_error') reject(new Error(`Couldn't start ${LANGUAGE_LABEL[language]}: ${e.data.error}`))
      else return
      worker.removeEventListener('message', onMessage)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', (e) => reject(new Error(e.message || `Couldn't start ${LANGUAGE_LABEL[language]}.`)), { once: true })
  })
  if (language === 'python') worker.postMessage({ type: 'load', indexURL: pyodideURL() })
  const slot = { worker, ready }
  slots.set(language, slot)
  ready.catch(() => slots.delete(language))
  return slot
}

const slot = (language: CodeLanguage) => slots.get(language) ?? spawn(language)

export const LANGUAGE_LABEL: Record<CodeLanguage, string> = { python: 'Python 3', sql: 'PostgreSQL' }

/** Start loading a runtime before the first Run, so it's usually ready by then. */
export function warmUp(language: CodeLanguage) {
  slot(language).ready.catch(() => {})
}


/**
 * Runs `code` on the visible tests (Run) or all tests (Submit). `onStage` reports when the
 * runtime is still loading and when the tests start.
 */
export async function runCode(
  spec: CodeSpec,
  code: string,
  kind: RunResult['kind'],
  onStage?: (stage: 'loading' | 'running') => void,
): Promise<RunResult> {
  const { tests, ...rest } = spec
  const chosen = kind === 'run' ? tests.filter((t) => !t.hidden) : tests
  const s = slot(spec.language)
  if (!readyFlags.has(spec.language)) onStage?.('loading')
  await s.ready
  readyFlags.add(spec.language)
  onStage?.('running')

  const id = nextId++
  const request: RunRequest = { id, code, spec: rest, tests: chosen, indexURL: pyodideURL() }
  const start = performance.now()
  const reply = await new Promise<Extract<WorkerMessage, { type: 'result' }> | null>((resolve) => {
    const timer = setTimeout(() => {
      // Endless loop or far too slow: stop the worker; the next run starts a fresh one.
      s.worker.terminate()
      slots.delete(spec.language)
      readyFlags.delete(spec.language)
      resolve(null)
    }, TIME_LIMIT_MS)
    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      if (e.data.type !== 'result' || e.data.id !== id) return
      clearTimeout(timer)
      s.worker.removeEventListener('message', onMessage)
      resolve(e.data)
    }
    s.worker.addEventListener('message', onMessage)
    s.worker.postMessage(request)
  })
  const ms = Math.round(performance.now() - start)
  const ran_at = new Date().toISOString()

  if (!reply) {
    return { kind, status: 'time_limit', passed: 0, total: chosen.length, error: `Time limit exceeded: stopped after ${TIME_LIMIT_MS / 1000} seconds.`, cases: [], ms, ran_at }
  }
  if (reply.compileError) {
    return { kind, status: 'compile_error', passed: 0, total: chosen.length, error: reply.compileError, cases: [], ms, ran_at }
  }
  const passed = reply.cases.filter((c) => c.status === 'pass').length
  const status: RunStatus = reply.cases.some((c) => c.status === 'error')
    ? 'runtime_error'
    : passed === reply.cases.length
      ? 'accepted'
      : 'wrong_answer'
  return { kind, status, passed, total: reply.cases.length, error: null, cases: reply.cases, ms, ran_at }
}

export const STATUS_LABEL: Record<RunStatus, string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  runtime_error: 'Runtime error',
  compile_error: 'Syntax error',
  time_limit: 'Time limit exceeded',
}
