import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency, formatDate, getStatusColor } from '../lib/formatters'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { FolderKanban, Plus, Pencil, Trash2, Search } from 'lucide-react'

const defaultForm = {
  name: '',
  description: '',
  targetAmount: '',
  startDate: '',
  endDate: '',
  status: 'active',
  returnRate: '',
  durationMonths: '',
}

export default function Projects() {
  const { projects, allocations, addProject, updateProject, deleteProject } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name || '',
      description: p.description || '',
      targetAmount: p.targetAmount || '',
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      status: p.status || 'active',
      returnRate: p.returnRate || '',
      durationMonths: p.durationMonths || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) await updateProject(editing.id, form)
    else await addProject(form)
    setModalOpen(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this project? This cannot be undone.')) {
      await deleteProject(id)
    }
  }

  const filtered = projects
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} total</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'completed', 'paused'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filter === s
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={projects.length === 0 ? "Add your first project to get started" : "Try a different search or filter"}
          action={
            projects.length === 0 && (
              <button onClick={openAdd} className="btn-primary text-sm">
                Add Project
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => {
            const projectAllocs = allocations.filter((a) => a.projectId === project.id)
            const funded = projectAllocs.reduce((s, a) => s + (Number(a.amount) || 0), 0)
            const target = Number(project.targetAmount) || 0
            const progress = target > 0 ? Math.min((funded / target) * 100, 100) : 0

            return (
              <div key={project.id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{project.name}</h3>
                      <span className={`badge ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button onClick={() => openEdit(project)} className="p-2 rounded-lg hover:bg-gray-100 transition">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(project.id)} className="p-2 rounded-lg hover:bg-red-50 transition">
                      <Trash2 size={14} className="text-gray-400 hover:text-danger-500" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {target > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{formatCurrency(funded)} funded</span>
                      <span>{formatCurrency(target)} target</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-400 to-accent-400 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {project.returnRate && <span>Return: {project.returnRate}%</span>}
                  {project.durationMonths && <span>Duration: {project.durationMonths}mo</span>}
                  {project.startDate && <span>Start: {formatDate(project.startDate)}</span>}
                  {project.endDate && <span>End: {formatDate(project.endDate)}</span>}
                  <span>{projectAllocs.length} investor{projectAllocs.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Project' : 'New Project'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="e.g. Property Renovation Jl. Sudirman"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              rows={2}
              placeholder="Brief description of the project"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount</label>
              <input
                type="number"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="100000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={form.returnRate}
                onChange={(e) => setForm({ ...form, returnRate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="12"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
              <input
                type="number"
                value={form.durationMonths}
                onChange={(e) => setForm({ ...form, durationMonths: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">
            {editing ? 'Save Changes' : 'Create Project'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
