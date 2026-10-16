// Renders question prompts, which may hold Markdown: tables for schemas and example data,
// code blocks, lists. Raw HTML is not rendered.

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cx } from '../lib/cx'

const components: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-4 font-semibold">{children}</h4>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
    ),
  pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-lg bg-raised p-3 font-mono text-sm">{children}</pre>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse font-mono text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-raised">{children}</thead>,
  th: ({ children }) => <th className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="whitespace-nowrap border-b border-line px-3 py-1.5 last:border-b-0">{children}</td>,
  tr: ({ children }) => <tr className="[&:last-child>td]:border-b-0">{children}</tr>,
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

