import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  PieChart,
  CalendarClock,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/investors', icon: Users, label: 'Investors' },
  { to: '/allocations', icon: PieChart, label: 'Allocations' },
  { to: '/payments', icon: CalendarClock, label: 'Payments' },
]

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <header className="glass sticky top-0 z-50 px-4 py-3 flex items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
            FundTracker
          </h1>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <nav className="hidden sm:flex flex-col w-56 p-3 gap-1 border-r border-gray-100 bg-white/50">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile bottom nav */}
        <nav
          className={`sm:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-gray-200 px-2 py-2 flex justify-around transition-transform duration-300 ${
            menuOpen ? 'translate-y-0' : ''
          }`}
        >
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-xs transition-all ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
