import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { defineThemes, monaco } from './monaco'
import type { CodeLanguage } from '../../lib/types'

/** Monaco with the app's colors. Ctrl/Cmd + Enter calls `onRun`. */
export default function CodeEditor({
  language,
  value,
  onChange,
  onRun,
  label,
}: {
  language: CodeLanguage
  value: string
  onChange: (v: string) => void
  onRun: () => void
  label: string
}) {
  const run = useRef(onRun)
  run.current = onRun
  const [theme, setTheme] = useState(defineThemes)

  // Follow the system theme while the page is open.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      setTheme(defineThemes())
      monaco.editor.setTheme('coach')
    }
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return (
    <Editor
      language={language}
      value={value}
      theme={theme}
      onChange={(v) => onChange(v ?? '')}
      loading={<span className="text-sm text-muted">Loading editor…</span>}
      onMount={(editor) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run.current())
        editor.focus()
      }}
      options={{
        ariaLabel: label,
        fontSize: 14,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        tabSize: 4,
        insertSpaces: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        lineNumbersMinChars: 3,
        renderLineHighlight: 'line',
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
        fixedOverflowWidgets: true,
        quickSuggestions: true,
        wordWrap: 'off',
        stickyScroll: { enabled: false },
      }}
    />
  )
}
