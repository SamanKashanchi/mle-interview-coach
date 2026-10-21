import { useEffect } from 'react'

/** Calls `reload` every `ms` while `active` and the tab is visible, e.g. while a grade is pending. */
export function usePollWhile(active: boolean, reload: () => void, ms = 20_000) {
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => document.visibilityState === 'visible' && reload(), ms)
    return () => clearInterval(t)
  }, [active, reload, ms])
}
