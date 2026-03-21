import { useData } from '../contexts/DataContext'
import { formatCurrency, daysUntil } from '../lib/formatters'
import {
  FolderKanban,
  Users,
  Wallet,
  CalendarClock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  border: '1px solid rgba(0,0,0,0.04)',
}

const gradients = [
  'linear-gradient(135deg, #6366f1, #818cf8)',
  'linear-gradient(135deg, #a855f7, #c084fc)',
  'linear-gradient(135deg, #10b981, #34d399)',
  'linear-gradient(135deg, #f59e0b, #fbbf24)',
]

function StatCard({ icon: Icon, label, value, gradient, to }) {
  return (
    <Link to={to} className="block" style={cardStyle}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{
          background: gradient,
          boxShadow: `0 4px 12px ${gradient.includes('6366') ? 'rgba(99,102,241,0.3)' : gradient.includes('a855') ? 'rgba(168,85,247,0.3)' : gradient.includes('10b9') ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
        </div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { projects, investors, allocations, payments, loading } = useData()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 rounded-full border-[3px] border-indigo-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const activeProjects = projects.filter((p) => p.status === 'active')
  const totalFunded = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
  const upcomingPayments = payments.filter(
    (p) => p.status === 'pending' && daysUntil(p.dueDate) >= 0 && daysUntil(p.dueDate) <= 30
  )
  const overduePayments = payments.filter(
    (p) => p.status === 'pending' && daysUntil(p.dueDate) < 0
  )

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview of your fund portfolio</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={FolderKanban} label="Active" value={activeProjects.length} gradient={gradients[0]} to="/projects" />
        <StatCard icon={Users} label="Investors" value={investors.length} gradient={gradients[1]} to="/investors" />
        <StatCard icon={Wallet} label="Funded" value={formatCurrency(totalFunded)} gradient={gradients[2]} to="/allocations" />
        <StatCard icon={CalendarClock} label="Due" value={upcomingPayments.length} gradient={gradients[3]} to="/payments" />
      </div>

      {/* Overdue alert */}
      {overduePayments.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{
          background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
          border: '1px solid rgba(239,68,68,0.15)',
        }}>
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="font-bold text-red-700 text-sm">
              {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-400 mt-0.5">Tap to review</p>
          </div>
        </div>
      )}

      {/* Active projects */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Active Projects</h2>
          <Link to="/projects" className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {activeProjects.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)' }}>
              <FolderKanban size={24} className="text-indigo-300" />
            </div>
            <p className="text-sm text-gray-400">No active projects yet</p>
            <Link to="/projects" className="inline-block mt-3 text-xs font-semibold text-white px-4 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              Add Project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeProjects.slice(0, 5).map((project) => {
              const projectAllocations = allocations.filter((a) => a.projectId === project.id)
              const funded = projectAllocations.reduce((s, a) => s + (Number(a.amount) || 0), 0)
              const target = Number(project.targetAmount) || 0
              const progress = target > 0 ? Math.min((funded / target) * 100, 100) : 0

              return (
                <div key={project.id} className="p-3 rounded-2xl" style={{ background: '#f8f9fc' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    }}>
                      <TrendingUp size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{project.name}</p>
                      {target > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                            <div className="h-full rounded-full" style={{
                              width: `${progress}%`,
                              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-400 shrink-0">{progress.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming payments */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Upcoming Payments</h2>
          <Link to="/payments" className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {upcomingPayments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No upcoming payments</p>
        ) : (
          <div className="space-y-2">
            {upcomingPayments.slice(0, 5).map((payment) => {
              const project = projects.find((p) => p.id === payment.projectId)
              const days = daysUntil(payment.dueDate)
              return (
                <div key={payment.id} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: '#f8f9fc' }}>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{project?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {days === 0 ? 'Due today' : `${days}d left`}
                    </p>
                  </div>
                  <p className="font-bold text-sm text-gray-900">{formatCurrency(payment.amount)}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
