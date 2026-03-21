import { useData } from '../contexts/DataContext'
import { formatCurrency, daysUntil, getStatusColor } from '../lib/formatters'
import {
  FolderKanban,
  Users,
  DollarSign,
  CalendarClock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

function StatCard({ icon: Icon, label, value, color, to }) {
  return (
    <Link to={to} className="card flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="text-left">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { projects, investors, allocations, payments, loading } = useData()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeProjects = projects.filter((p) => p.status === 'active')
  const totalFunded = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
  const totalInvestors = investors.length
  const upcomingPayments = payments.filter(
    (p) => p.status === 'pending' && daysUntil(p.dueDate) >= 0 && daysUntil(p.dueDate) <= 30
  )
  const overduePayments = payments.filter(
    (p) => p.status === 'pending' && daysUntil(p.dueDate) < 0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your fund portfolio</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          icon={FolderKanban}
          label="Active Projects"
          value={activeProjects.length}
          color="bg-primary-500"
          to="/projects"
        />
        <StatCard
          icon={Users}
          label="Investors"
          value={totalInvestors}
          color="bg-accent-500"
          to="/investors"
        />
        <StatCard
          icon={DollarSign}
          label="Total Funded"
          value={formatCurrency(totalFunded)}
          color="bg-success-500"
          to="/allocations"
        />
        <StatCard
          icon={CalendarClock}
          label="Due This Month"
          value={upcomingPayments.length}
          color="bg-warning-500"
          to="/payments"
        />
      </div>

      {/* Overdue alert */}
      {overduePayments.length > 0 && (
        <div className="bg-danger-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-danger-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-danger-600 text-sm">
              {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-500 mt-0.5">Check your payments tab for details</p>
          </div>
        </div>
      )}

      {/* Active projects list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Active Projects</h2>
          <Link to="/projects" className="text-sm text-primary-500 font-medium">
            View all
          </Link>
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No active projects yet</p>
        ) : (
          <div className="space-y-3">
            {activeProjects.slice(0, 5).map((project) => {
              const projectAllocations = allocations.filter((a) => a.projectId === project.id)
              const funded = projectAllocations.reduce((s, a) => s + (Number(a.amount) || 0), 0)
              const target = Number(project.targetAmount) || 0
              const progress = target > 0 ? Math.min((funded / target) * 100, 100) : 0

              return (
                <div key={project.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{project.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-400 to-accent-400 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">{progress.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent payments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Upcoming Payments</h2>
          <Link to="/payments" className="text-sm text-primary-500 font-medium">
            View all
          </Link>
        </div>
        {upcomingPayments.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No upcoming payments</p>
        ) : (
          <div className="space-y-2">
            {upcomingPayments.slice(0, 5).map((payment) => {
              const project = projects.find((p) => p.id === payment.projectId)
              const days = daysUntil(payment.dueDate)
              return (
                <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{project?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">
                      {days === 0 ? 'Due today' : `Due in ${days} day${days > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-gray-900">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
