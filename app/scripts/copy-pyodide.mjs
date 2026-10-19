// Copies the Pyodide runtime from node_modules into public/pyodide so the app serves it
// itself (no CDN needed to run Python). Runs before dev and build.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const from = dirname(require.resolve('pyodide/package.json'))
const to = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pyodide')
mkdirSync(to, { recursive: true })
for (const f of ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  const dst = join(to, f)
  if (existsSync(dst) && statSync(dst).size === statSync(join(from, f)).size) continue
  copyFileSync(join(from, f), dst)
}
