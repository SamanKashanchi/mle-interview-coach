// Comparing SQL results. Postgres returns values as text here (see SQL_PARSERS), so a result
// and its expected table compare the way a person reads them: 0.666 matches 0.67,
// "2026-09-07 00:00:00" matches "2026-09-07", and row order is ignored unless the test says so.

import type { SqlTable } from '../types'

const asText = (v: string) => v
/** Type parsers for PGlite: dates, times, numerics and bigints stay text, as psql prints them. */
export const SQL_PARSERS = { 20: asText, 1082: asText, 1083: asText, 1114: asText, 1184: asText, 1186: asText, 1700: asText }

const NUMBER = /^-?\d+(\.\d+)?(e-?\d+)?$/i

function norm(v: unknown): string | number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.000Z$/, '')
  const s = String(v).trim()
  if (NUMBER.test(s)) return Number(s)
  if (s === 't' || s === 'f') return s === 't' ? 'true' : 'false'
  // Timestamps: drop zero seconds, a UTC offset and a midnight time.
  return s
    .replace(/^(\d{4}-\d{2}-\d{2})T/, '$1 ')
    .replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):00(\.0+)?/, '$1')
    .replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})(\+00(:00)?|Z)$/, '$1')
    .replace(/^(\d{4}-\d{2}-\d{2}) 00:00$/, '$1')
}

function same(a: string | number | null, b: string | number | null) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 0.0051 * Math.max(1, Math.abs(b) / 100)
  return a === b
}

const key = (row: (string | number | null)[]) => JSON.stringify(row.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)))

export function tablesMatch(got: SqlTable, expected: SqlTable, ordered = false) {
  if (got.columns.length !== expected.columns.length || got.rows.length !== expected.rows.length) return false
  let a = got.rows.map((r) => r.map(norm))
  let b = expected.rows.map((r) => r.map(norm))
  if (!ordered) {
    a = [...a].sort((x, y) => key(x).localeCompare(key(y)))
    b = [...b].sort((x, y) => key(x).localeCompare(key(y)))
  }
  return a.every((row, i) => row.every((v, j) => same(v, b[i][j])))
}

/** Values as strings for display and storage. */
export const cell = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? (norm(v) as string) : typeof v === 'object' ? JSON.stringify(v) : String(v)
