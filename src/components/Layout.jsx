import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  PieChart,
  CalendarClock,
} from 'lucide-react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/investors', icon: Users, label: 'Investors' },
  { to: '/allocations', icon: PieChart, label: 'Funds' },
  { to: '/payments', icon: CalendarClock, label: 'Payments' },
]

export default function Layout({ children }) {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top header - mobile only */}
      <header className="sm:hidden sticky top-0 z-50 px-5 py-4" style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <h1 className="text-xl font-extrabold" style={{
          background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          FundTracker
        </h1>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <nav className="hidden sm:flex flex-col w-60 p-4 gap-1.5 sticky top-0 h-dvh" style={{
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
        }}>
          <h1 className="text-xl font-extrabold mb-6 px-3 pt-2" style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            FundTracker
          </h1>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'text-white shadow-lg'
                    : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
              } : {}}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile bottom tab bar */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 ${
                  isActive ? 'text-indigo-600' : 'text-gray-400'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(99,102,241,0.1)',
              } : {}}
            >
              <Icon size={22} strokeWidth={({ isActive }) => isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-semibold">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-5 sm:p-8 pb-28 sm:pb-8 max-w-3xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
