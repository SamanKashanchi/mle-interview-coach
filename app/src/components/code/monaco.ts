// Monaco (the editor inside VS Code), bundled with the app instead of loaded from a CDN.
// Only the core editor plus Python and SQL highlighting, to keep the download small.

import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { loader } from '@monaco-editor/react'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })

const PYTHON = [
  'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'True', 'try', 'while', 'with', 'yield', 'abs', 'all', 'any', 'bisect', 'collections', 'Counter', 'defaultdict',
  'deque', 'dict', 'enumerate', 'filter', 'float', 'heapq', 'heappop', 'heappush', 'int', 'isinstance', 'itertools',
  'len', 'list', 'map', 'math', 'max', 'min', 'print', 'range', 'reversed', 'round', 'set', 'sorted', 'str', 'sum',
  'tuple', 'zip', 'functools', 'lru_cache', 'numpy', 'pandas',
]
const SQL = [
  'select', 'from', 'where', 'group by', 'order by', 'having', 'join', 'left join', 'inner join', 'on', 'as', 'with',
  'distinct', 'count', 'sum', 'avg', 'min', 'max', 'case', 'when', 'then', 'else', 'end', 'coalesce', 'nullif',
  'interval', 'date_trunc', 'extract', 'epoch', 'percentile_cont', 'within group', 'filter', 'over', 'partition by',
  'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'rows between', 'unbounded preceding', 'current row', 'limit',
  'union all', 'exists', 'in', 'between', 'is null', 'is not null', 'round', 'cast', 'numeric', 'date', 'timestamp',
]

for (const [language, words] of [['python', PYTHON], ['sql', SQL]] as const) {
  monaco.languages.registerCompletionItemProvider(language, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
      return {
        suggestions: words.map((w) => ({ label: w, kind: monaco.languages.CompletionItemKind.Keyword, insertText: w, range })),
      }
    },
  })
}

/** Editor colors from the app's own tokens, so it sits on the page instead of in a black box. */
export function defineThemes() {
  const css = getComputedStyle(document.documentElement)
  // Monaco only takes #rrggbb; minified CSS may have shortened #ffffff to #fff.
  const v = (name: string) => {
    const c = css.getPropertyValue(name).trim()
    return /^#[0-9a-f]{3}$/i.test(c) ? `#${[...c.slice(1)].map((x) => x + x).join('')}` : c
  }
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  monaco.editor.defineTheme('coach', {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': v('--surface'),
      'editor.lineHighlightBackground': v('--raised'),
      'editorLineNumber.foreground': v('--faint'),
      'editorLineNumber.activeForeground': v('--muted'),
      'editorGutter.background': v('--surface'),
      'editorCursor.foreground': v('--accent'),
    },
  })
  return 'coach'
}

export { monaco }
