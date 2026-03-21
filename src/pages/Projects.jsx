import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency, formatDate } from '../lib/formatters'
import { card, innerCard, btnPrimary, badge, input, label as labelStyle } from '../lib/styles'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { FolderKanban, Plus, Pencil, Trash2, Search, TrendingUp } from 'lucide-react'

const defaultForm = { name: '', description: '', targetAmount: '', startDate: '', endDate: '', status: 'active', returnRate: '', durationMonths: '' }

export default function Projects() {
  const { projects, allocations, addProject, updateProject, deleteProject } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const openAdd = () => { setEditing(null); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({ name: p.name || '', description: p.description || '', targetAmount: p.targetAmount || '', startDate: p.startDate || '', endDate: p.endDate || '', status: p.status || 'active', returnRate: p.returnRate || '', durationMonths: p.durationMonths || '' })
    setModalOpen(true)
  }
  const handleSubmit = async (e) => { e.preventDefault(); if (editing) await updateProject(editing.id, form); else await addProject(form); setModalOpen(false) }
  const handleDelete = async (id) => { if (window.confirm('Delete this project?')) await deleteProject(id) }

  const filtered = projects.filter((p) => filter === 'all' || p.status === filter).filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-400 mt-1">{projects.length} total</p>
        </div>
        <button onClick={openAdd} style={btnPrimary}><Plus size={16} /> Add</button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ ...input, paddingLeft: '40px' }} />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'active', 'completed', 'paused'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={filter === s ? { ...btnPrimary, fontSize: '12px', padding: '8px 16px', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' } : { background: 'white', color: '#6b7280', fontWeight: 600, fontSize: '12px', padding: '8px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found" description={projects.length === 0 ? "Add your first project to get started" : "Try a different search"}
          action={projects.length === 0 && <button onClick={openAdd} style={btnPrimary}>Add Project</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => {
            const pa = allocations.filter((a) => a.projectId === project.id)
            const funded = pa.reduce((s, a) => s + (Number(a.amount) || 0), 0)
            const target = Number(project.targetAmount) || 0
            const progress = target > 0 ? Math.min((funded / target) * 100, 100) : 0
            return (
              <div key={project.id} style={card}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    }}>
                      <TrendingUp size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-sm truncate">{project.name}</h3>
                        <span style={badge(project.status)}>{project.status}</span>
                      </div>
                      {project.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{project.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0 ml-2">
                    <button onClick={() => openEdit(project)} className="p-2 rounded-xl hover:bg-gray-50 transition"><Pencil size={14} className="text-gray-300" /></button>
                    <button onClick={() => handleDelete(project.id)} className="p-2 rounded-xl hover:bg-red-50 transition"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>
                  </div>
                </div>
                {target > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-gray-400 font-medium mb-1.5">
                      <span>{formatCurrency(funded)}</span>
                      <span>{formatCurrency(target)}</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#eef2ff' }}>
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 font-medium mt-3">
                  {project.returnRate && <span>Return: {project.returnRate}%</span>}
                  {project.durationMonths && <span>Duration: {project.durationMonths}mo</span>}
                  {project.startDate && <span>Start: {formatDate(project.startDate)}</span>}
                  <span>{pa.length} investor{pa.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Project' : 'New Project'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label style={labelStyle}>Project Name *</label><input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} placeholder="e.g. Property Renovation" /></div>
          <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...input, minHeight: '60px', resize: 'vertical' }} placeholder="Brief description" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Target Amount</label><input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} style={input} placeholder="100000000" /></div>
            <div><label style={labelStyle}>Return Rate (%)</label><input type="number" step="0.1" value={form.returnRate} onChange={(e) => setForm({ ...form, returnRate: e.target.value })} style={input} placeholder="12" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Duration (months)</label><input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} style={input} placeholder="12" /></div>
            <div><label style={labelStyle}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
              <option value="active">Active</option><option value="completed">Completed</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option>
            </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Start Date</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={input} /></div>
            <div><label style={labelStyle}>End Date</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={input} /></div>
          </div>
          <button type="submit" style={{ ...btnPrimary, width: '100%', justifyContent: 'center', marginTop: '8px' }}>{editing ? 'Save Changes' : 'Create Project'}</button>
        </form>
      </Modal>
    </div>
  )
}
