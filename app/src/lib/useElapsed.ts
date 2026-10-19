import { useEffect, useRef, useState } from 'react'

/** Seconds since the component mounted, ticking once a second. */
export function useElapsed() {
  const start = useRef(Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return Math.floor((now - start.current) / 1000)
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
