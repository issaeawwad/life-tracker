import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  House,
  Barbell,
  ForkKnife,
  CalendarBlank,
  ClipboardText,
  SignOut,
} from '@phosphor-icons/react'

const navItems = [
  { to: '/', label: 'Home', icon: House },
  { to: '/workouts', label: 'Workouts', icon: Barbell },
  { to: '/meals', label: 'Meals', icon: ForkKnife },
  { to: '/schedule', label: 'Schedule', icon: CalendarBlank },
  { to: '/review', label: 'Review', icon: ClipboardText },
]

export default function Layout({ children }) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-background/90 backdrop-blur-xl border-b border-border/60">
        <h1 className="font-display text-base font-semibold text-foreground tracking-tight">
          Life Tracker
        </h1>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          aria-label="Sign out"
        >
          <SignOut size={17} />
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-5">
          {children}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/60"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground/70'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
