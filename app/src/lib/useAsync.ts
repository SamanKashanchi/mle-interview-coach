import { useCallback, useEffect, useState, type DependencyList } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

/** Runs a loader on mount (and when deps change) and tracks loading, error and retry. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    run()
      .then((d) => active && setData(d))
      .catch((e: Error) => active && setError(e.message || 'Something went wrong.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [run, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload }
}
