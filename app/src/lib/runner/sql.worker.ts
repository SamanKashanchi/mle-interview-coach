// Runs SQL answers in real Postgres (PGlite, compiled to WebAssembly). Every test case starts
// from an empty database: the question's schema, then the case's rows, then the answer.

import { PGlite, type Results } from '@electric-sql/pglite'
import type { CaseResult, SqlTable } from '../types'
import type { RunRequest, WorkerMessage } from './protocol'
import { cell, SQL_PARSERS, tablesMatch } from './sql'

const post = (m: WorkerMessage) => self.postMessage(m)

const ready = PGlite.create({ parsers: SQL_PARSERS }).then(
  (pg) => {
    post({ type: 'ready' })
    return pg
  },
  (e: Error) => {
    post({ type: 'load_error', error: e.message })
    throw e
  },
)

const toTable = (r: Results<unknown[]>): SqlTable => ({
  columns: r.fields.map((f) => f.name),
  rows: r.rows.map((row) => row.map(cell)),
})

async function reset(pg: PGlite) {
  await pg.exec('drop schema if exists public cascade; create schema public; set search_path to public;')
}

async function inputTables(pg: PGlite) {
  const names = await pg.query<[string]>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by c.oid`,
    [],
    { rowMode: 'array' },
  )
  const out: CaseResult['inputs'] = []
  for (const [name] of names.rows) {
    const rows = await pg.query<unknown[]>(`select * from "${name.replace(/"/g, '""')}" limit 50`, [], { rowMode: 'array' })
    out.push({ label: name, value: { table: toTable(rows) } })
  }
  return out
}

const message = (e: unknown) => {
  const err = e as { message?: string; position?: string; hint?: string }
  return [err.message ?? String(e), err.hint && `Hint: ${err.hint}`].filter(Boolean).join('\n')
}

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, code, spec, tests } = e.data
  const pg = await ready
  const cases: CaseResult[] = []
  for (const t of tests) {
    const expected = t.expected as SqlTable
    const base = { name: t.name, hidden: t.hidden, expected: { table: expected }, stdout: '' }
    await reset(pg)
    try {
      if (spec.schema) await pg.exec(spec.schema)
      if (t.setup) await pg.exec(t.setup)
    } catch (err) {
      cases.push({ ...base, status: 'error', inputs: [], output: null, error: `The test data failed to load: ${message(err)}`, ms: 0 })
      continue
    }
    const inputs = await inputTables(pg)
    const start = performance.now()
    try {
      const results = await pg.exec(code, { rowMode: 'array' })
      const ms = Math.round(performance.now() - start)
      const last = [...results].reverse().find((r) => r.fields.length > 0)
      if (!last) {
        cases.push({ ...base, status: 'error', inputs, output: null, error: 'Your query returned no table. End with a SELECT.', ms })
        continue
      }
      const output = toTable(last as Results<unknown[]>)
      const ok = tablesMatch(output, expected, t.ordered ?? false)
      cases.push({ ...base, status: ok ? 'pass' : 'fail', inputs, output: { table: output }, error: null, ms })
    } catch (err) {
      cases.push({ ...base, status: 'error', inputs, output: null, error: message(err), ms: Math.round(performance.now() - start) })
    }
  }
  post({ type: 'result', id, compileError: null, cases })
}
