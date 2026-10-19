// Runs Python answers in Pyodide (CPython compiled to WebAssembly). The Pyodide files are
// self-hosted under /pyodide/ (scripts/copy-pyodide.mjs); extra packages such as numpy and
// pandas load from the Pyodide CDN the first time an answer imports them.

import type { PyodideInterface } from 'pyodide'
import type { RunRequest, WorkerMessage } from './protocol'
import HARNESS from './harness.py?raw'

const post = (m: WorkerMessage) => self.postMessage(m)
const VERSION = '0.29.5'

let py: Promise<PyodideInterface> | null = null

function load(indexURL: string) {
  py ??= (async () => {
    const { loadPyodide } = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as typeof import('pyodide')
    const p = await loadPyodide({ indexURL, packageBaseUrl: `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/` })
    p.runPython(HARNESS)
    return p
  })().then(
    (p) => {
      post({ type: 'ready' })
      return p
    },
    (e: Error) => {
      post({ type: 'load_error', error: e.message })
      throw e
    },
  )
  return py
}

self.onmessage = async (e: MessageEvent<RunRequest | { type: 'load'; indexURL: string }>) => {
  if ('type' in e.data) return void load(e.data.indexURL).catch(() => {})
  const { id, code, spec, tests, indexURL } = e.data
  const p = await load(indexURL!)
  try {
    await p.loadPackagesFromImports(code)
  } catch {
    // An unknown import fails on run with a clear ModuleNotFoundError.
  }
  const run = p.globals.get('_run_tests')
  const out = JSON.parse(run(code, JSON.stringify({ entry: spec.entry, params: spec.params ?? [], tests })))
  run.destroy()
  post({ type: 'result', id, compileError: out.compile_error ?? null, cases: out.cases ?? [] })
}
