import type { CaseResult, CodeSpec, CodeTest } from '../types'

/** Main thread -> worker. */
export interface RunRequest {
  id: number
  code: string
  spec: Omit<CodeSpec, 'tests'>
  tests: CodeTest[]
  /** Python only: where the self-hosted Pyodide files are. */
  indexURL?: string
}

/** Worker -> main thread. */
export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'load_error'; error: string }
  | { type: 'result'; id: number; compileError: string | null; cases: CaseResult[] }
