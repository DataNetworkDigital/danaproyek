import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency, formatPercent } from '../lib/formatters'
import { card, btnPrimary, input, label as labelStyle } from '../lib/styles'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { PieChart, Plus, Pencil, Trash2, ArrowRight } from 'lucide-react'

const defaultForm = { projectId: '', investorId: '', amount: '', percentage: '', notes: '' }

export default function Allocations() {
  const { allocations, projects, investors, addAllocation, updateAllocation, deleteAllocation } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [filterProject, setFilterProject] = useState('all')

  const openAdd = () => { setEditing(null); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (a) => { setEditing(a); setForm({ projectId: a.projectId || '', investorId: a.investorId || '', amount: a.amount || '', percentage: a.percentage || '', notes: a.notes || '' }); setModalOpen(true) }
  const handleSubmit = async (e) => { e.preventDefault(); if (editing) await updateAllocation(editing.id, form); else await addAllocation(form); setModalOpen(false) }
  const handleDelete = async (id) => { if (window.confirm('Delete?')) await deleteAllocation(id) }

  const filtered = filterProject === 'all' ? allocations : allocations.filter((a) => a.projectId === filterProject)
  const activeProjects = projects.filter((p) => p.status === 'active')
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Allocations</h1>
          <p className="text-sm text-gray-400 mt-1">Who funds what</p>
        </div>
        <button onClick={openAdd} style={btnPrimary}><Plus size={16} /> Add</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterProject('all')}
          style={filterProject === 'all' ? { ...btnPrimary, fontSize: '12px', padding: '8px 16px' } : { background: 'white', color: '#6b7280', fontWeight: 600, fontSize: '12px', padding: '8px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          All
        </button>
        {activeProjects.map((p) => (
          <button key={p.id} onClick={() => setFilterProject(p.id)}
            style={filterProject === p.id ? { ...btnPrimary, fontSize: '12px', padding: '8px 16px' } : { background: 'white', color: '#6b7280', fontWeight: 600, fontSize: '12px', padding: '8px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {p.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={PieChart} title="No allocations yet" description="Link investor funds to projects"
          action={projects.length > 0 && investors.length > 0 ? <button onClick={openAdd} style={btnPrimary}>Add Allocation</button> :
            <p className="text-xs text-gray-400">{projects.length === 0 && 'Add projects first. '}{investors.length === 0 && 'Add investors first.'}</p>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((alloc, idx) => {
            const project = projects.find((p) => p.id === alloc.projectId)
            const investor = investors.find((i) => i.id === alloc.investorId)
            const color = colors[idx % colors.length]
            return (
              <div key={alloc.id} style={card}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                      <span className="text-xs font-bold" style={{ color }}>{investor?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{investor?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <ArrowRight size={10} /> {project?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="font-bold text-sm text-gray-900">{formatCurrency(alloc.amount)}</p>
                      {alloc.percentage && <p className="text-[11px] font-semibold" style={{ color }}>{formatPercent(alloc.percentage)}</p>}
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => openEdit(alloc)} className="p-1.5 rounded-lg hover:bg-gray-50 transition"><Pencil size={12} className="text-gray-300" /></button>
                      <button onClick={() => handleDelete(alloc.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition"><Trash2 size={12} className="text-gray-300 hover:text-red-400" /></button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {filterProject !== 'all' && filtered.length > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid rgba(99,102,241,0.1)' }}>
              <h3 className="font-bold text-sm text-indigo-700 mb-3">Funding Breakdown</h3>
              {filtered.map((a, i) => {
                const inv = investors.find((x) => x.id === a.investorId)
                const total = filtered.reduce((s, x) => s + (Number(x.amount) || 0), 0)
                const pct = total > 0 ? ((Number(a.amount) || 0) / total) * 100 : 0
                return (
                  <div key={a.id} className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.1)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                    <span className="text-xs font-semibold text-indigo-600 w-28 text-right">{inv?.name}: {pct.toFixed(1)}%</span>
                  </div>
                )
              })}
              <p className="text-xs font-bold text-indigo-700 mt-3">Total: {formatCurrency(filtered.reduce((s, a) => s + (Number(a.amount) || 0), 0))}</p>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Allocation' : 'New Allocation'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label style={labelStyle}>Project *</label><select required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} style={input}>
            <option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label style={labelStyle}>Investor *</label><select required value={form.investorId} onChange={(e) => setForm({ ...form, investorId: e.target.value })} style={input}>
            <option value="">Select investor</option>{investors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Amount *</label><input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input} placeholder="50000000" /></div>
            <div><label style={labelStyle}>Share (%)</label><input type="number" step="0.1" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} style={input} placeholder="50" /></div>
          </div>
          <div><label style={labelStyle}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...input, minHeight: '60px', resize: 'vertical' }} /></div>
          <button type="submit" style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>{editing ? 'Save Changes' : 'Add Allocation'}</button>
        </form>
      </Modal>
    </div>
  )
}
