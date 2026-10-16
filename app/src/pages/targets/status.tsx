import { CheckCircle2, CircleDashed, Loader2, TriangleAlert } from 'lucide-react'
import { CONFIDENCE_LABEL } from '../../lib/format'
import type { TargetView } from '../../lib/types'
import { Badge } from '../../components/ui'

export function ResearchStatusBadge({ research }: { research: TargetView['research'] }) {
  if (research?.status === 'done') {
    return (
      <>
        <Badge tone="accent">
          <CheckCircle2 aria-hidden className="size-3.5" /> Research ready
        </Badge>
        {research.confidence && <Badge>{CONFIDENCE_LABEL[research.confidence]}</Badge>}
      </>
    )
  }
  if (research?.status === 'running') {
    return (
      <Badge tone="warn">
        <Loader2 aria-hidden className="size-3.5 animate-spin" /> Researching
      </Badge>
    )
  }
  if (research?.status === 'failed') {
    return (
      <Badge tone="warn">
        <TriangleAlert aria-hidden className="size-3.5" /> Research needs a retry
      </Badge>
    )
  }
  return (
    <Badge tone="warn">
      <CircleDashed aria-hidden className="size-3.5" /> Research pending
    </Badge>
  )
}
