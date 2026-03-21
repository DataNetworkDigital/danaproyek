import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency, formatPercent, getStatusColor } from '../lib/formatters'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { PieChart, Plus, Pencil, Trash2 } from 'lucide-react'

const defaultForm = { projectId: '', investorId: '', amount: '', percentage: '', notes: '' }

export default function Allocations() {
  const {
    allocations, projects, investors,
    addAllocation, updateAllocation, deleteAllocation,
  } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [filterProject, setFilterProject] = useState('all')

  const openAdd = () => { setEditing(null); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (a) => {
    setEditing(a)
    setForm({
      projectId: a.projectId || '',
      investorId: a.investorId || '',
      amount: a.amount || '',
      percentage: a.percentage || '',
      notes: a.notes || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) await updateAllocation(editing.id, form)
    else await addAllocation(form)
    setModalOpen(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this allocation?')) await deleteAllocation(id)
  }

  const filtered = filterProject === 'all'
    ? allocations
    : allocations.filter((a) => a.projectId === filterProject)

  // Group by project for overview
  const projectGroups = {}
  for (const alloc of allocations) {
    if (!projectGroups[alloc.projectId]) projectGroups[alloc.projectId] = []
    projectGroups[alloc.projectId].push(alloc)
  }

  const activeProjects = projects.filter((p) => p.status === 'active')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Allocations</h1>
          <p className="text-sm text-gray-500 mt-1">Who funds what</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Project filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterProject('all')}
          className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            filterProject === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Projects
        </button>
        {activeProjects.map((p) => (
          <button
            key={p.id}
            onClick={() => setFilterProject(p.id)}
            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              filterProject === p.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Allocation breakdown by project */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No allocations yet"
          description="Allocate investor funds to projects to track who funds what"
          action={
            projects.length > 0 && investors.length > 0 ? (
              <button onClick={openAdd} className="btn-primary text-sm">Add Allocation</button>
            ) : (
              <p className="text-xs text-gray-400">
                {projects.length === 0 && 'Add projects first. '}
                {investors.length === 0 && 'Add investors first.'}
              </p>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((alloc) => {
            const project = projects.find((p) => p.id === alloc.projectId)
            const investor = investors.find((i) => i.id === alloc.investorId)

            return (
              <div key={alloc.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">
                          {investor?.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{investor?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">→ {project?.name || 'Unknown project'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      <p className="font-bold text-sm text-gray-900">{formatCurrency(alloc.amount)}</p>
                      {alloc.percentage && (
                        <p className="text-xs text-accent-500 font-medium">{formatPercent(alloc.percentage)}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => openEdit(alloc)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                        <Pencil size={12} className="text-gray-400" />
                      </button>
                      <button onClick={() => handleDelete(alloc.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition">
                        <Trash2 size={12} className="text-gray-400 hover:text-danger-500" />
                      </button>
                    </div>
                  </div>
                </div>
                {alloc.notes && <p className="text-xs text-gray-400 mt-2">{alloc.notes}</p>}
              </div>
            )
          })}

          {/* Summary for filtered project */}
          {filterProject !== 'all' && (
            <div className="card bg-primary-50/50 border-primary-100">
              <h3 className="font-bold text-sm text-primary-700 mb-2">Funding Summary</h3>
              <div className="space-y-1">
                {filtered.map((a) => {
                  const inv = investors.find((i) => i.id === a.investorId)
                  const total = filtered.reduce((s, x) => s + (Number(x.amount) || 0), 0)
                  const pct = total > 0 ? ((Number(a.amount) || 0) / total) * 100 : 0
                  return (
                    <div key={a.id} className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-primary-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-400 to-accent-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-primary-700 font-medium w-20 text-right">
                        {inv?.name}: {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
                <p className="text-xs text-primary-600 font-semibold mt-2">
                  Total: {formatCurrency(filtered.reduce((s, a) => s + (Number(a.amount) || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Allocation' : 'New Allocation'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select
              required
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Investor *</label>
            <select
              required
              value={form.investorId}
              onChange={(e) => setForm({ ...form, investorId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">Select investor</option>
              {investors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                required
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="50000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Share (%)</label>
              <input
                type="number"
                step="0.1"
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              rows={2}
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {editing ? 'Save Changes' : 'Add Allocation'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
