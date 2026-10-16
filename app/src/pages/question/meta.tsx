import { Building2, Clock } from 'lucide-react'
import { FORMAT_LABEL } from '../../lib/format'
import type { QuestionView } from '../../lib/types'
import { Badge } from '../../components/ui'
import { cx } from '../../lib/cx'

export function Difficulty({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Difficulty ${value} of 5`}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cx('h-2.5 w-1.5 rounded-sm', i <= value ? 'bg-accent' : 'bg-line')} />
        ))}
      </span>
      <span className="sr-only">Difficulty {value} of 5</span>
    </span>
  )
}

/** Format, company, difficulty and minutes in one wrapping row. */
export function QuestionMeta({ q, className }: { q: QuestionView; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted', className)}>
      <Badge tone="accent">{FORMAT_LABEL[q.format]}</Badge>
      {q.company && (
        <span className="inline-flex items-center gap-1.5">
          <Building2 aria-hidden className="size-4 text-faint" />
          {q.company}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <Clock aria-hidden className="size-4 text-faint" />
        {q.minutes} min
      </span>
      <Difficulty value={q.difficulty} />
    </div>
  )
}
