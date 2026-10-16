import { createContext, useContext } from 'react'
import type { SessionUser } from './types'

export type Setup = 'unknown' | 'incomplete' | 'complete'

export interface AuthValue {
  user: SessionUser | null
  ready: boolean
  setup: Setup
  setupError: string | null
  refreshSetup: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
