// Session handling and route guards. One provider knows who is signed in and whether
// they have finished onboarding; the guards redirect based on that.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { db } from './db'
import type { SessionUser } from './types'
import { AuthContext, useAuth, type Setup } from './useAuth'
import { FullPageSpinner, ErrorState } from '../components/ui'

// Onboarding is done once there's a profile with a daily time and at least one target.
async function checkSetup(): Promise<Setup> {
  const [profile, targets] = await Promise.all([db.getProfile(), db.listTargets()])
  return profile?.name && profile.minutes_per_day != null && targets.length > 0 ? 'complete' : 'incomplete'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [setup, setSetup] = useState<Setup>('unknown')
  const [setupError, setSetupError] = useState<string | null>(null)

  const refreshSetup = useCallback(async () => {
    setSetupError(null)
    try {
      setSetup(await checkSetup())
    } catch (e) {
      setSetupError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    let active = true
    db.getUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setReady(true))
    const off = db.onAuthChange((u) => {
      setUser((prev) => (prev?.id === u?.id ? prev : u))
      setReady(true)
    })
    return () => {
      active = false
      off()
    }
  }, [])

  useEffect(() => {
    setSetup('unknown')
    if (user) void refreshSetup()
  }, [user, refreshSetup])

  const signOut = useCallback(async () => {
    await db.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, ready, setup, setupError, refreshSetup, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Only signed-in users get past this; everyone else goes to the sign-in page. */
export function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <FullPageSpinner />
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** The portal needs onboarding finished; until then, send the user to the wizard. */
export function RequireSetup() {
  const { setup, setupError, refreshSetup } = useAuth()
  if (setupError) return <ErrorState message={setupError} onRetry={refreshSetup} className="mx-auto mt-24 max-w-md" />
  if (setup === 'unknown') return <FullPageSpinner />
  if (setup === 'incomplete') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Signed-in users skip the sign-in page. */
export function RedirectIfSignedIn() {
  const { user, ready } = useAuth()
  if (!ready) return <FullPageSpinner />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
