import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarCheck, Crosshair, ListOrdered, UserRound } from 'lucide-react'
import { Logo } from '../components/Logo'
import { cx } from '../lib/cx'
import { isMock } from '../lib/db'
import { useAuth } from '../lib/useAuth'

const NAV = [
  { to: '/', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/plan', label: 'Plan', icon: ListOrdered },
  { to: '/targets', label: 'Targets', icon: Crosshair },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export default function Layout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // Question pages count as part of Today for the nav highlight.
  const isActive = (to: string, active: boolean) => active || (to === '/' && pathname.startsWith('/questions'))
  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <Logo className="px-3" />
        <nav aria-label="Main" className="mt-10 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive: a }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(to, a) ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-raised hover:text-ink',
                )
              }
            >
              <Icon aria-hidden className="size-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-3 text-xs text-faint">
          {isMock && <p className="mb-1 font-medium text-warn-text">Mock data</p>}
          <p className="truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
        <Logo />
        {isMock && <span className="text-xs font-medium text-warn-text">Mock data</span>}
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-12">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive: a }) =>
                  cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive(to, a) ? 'text-accent-text' : 'text-faint')
                }
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
