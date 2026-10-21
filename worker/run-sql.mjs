// Runs SQL files in a fresh PGlite database and prints the last result table as JSON, the way the
// portal's SQL runner sees it (dates, numerics and bigints stay text). The question writer uses it
// to compute `expected` for SQL tests.
//
//   node worker/run-sql.mjs schema.sql setup.sql solution.sql

import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const asText = (v) => v
// Same as SQL_PARSERS in app/src/lib/runner/sql.ts.
const parsers = { 20: asText, 1082: asText, 1083: asText, 1114: asText, 1184: asText, 1186: asText, 1700: asText }

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: node worker/run-sql.mjs file.sql [more.sql ...]')
  process.exit(2)
}

const db = await PGlite.create({ parsers })
let last = null
try {
  for (const f of files) {
    const results = await db.exec(readFileSync(f, 'utf8'))
    const table = results.findLast((r) => r.fields.length)
    if (table) last = table
  }
} catch (e) {
  console.error(`SQL error: ${e.message}`)
  process.exit(1)
}
if (!last) {
  console.log('no result table')
} else {
  const columns = last.fields.map((f) => f.name)
  const rows = last.rows.map((r) => columns.map((c) => (r[c] == null ? null : String(r[c]))))
  console.log(JSON.stringify({ columns, rows }))
}
await db.close()
