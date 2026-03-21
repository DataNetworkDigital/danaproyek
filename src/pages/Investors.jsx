import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency } from '../lib/formatters'
import { card, btnPrimary, input, label as labelStyle } from '../lib/styles'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { Users, Plus, Pencil, Trash2, Search, Phone, Mail } from 'lucide-react'

const defaultForm = { name: '', email: '', phone: '', notes: '' }

export default function Investors() {
  const { investors, allocations, addInvestor, updateInvestor, deleteInvestor } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [search, setSearch] = useState('')

  const openAdd = () => { setEditing(null); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (inv) => { setEditing(inv); setForm({ name: inv.name || '', email: inv.email || '', phone: inv.phone || '', notes: inv.notes || '' }); setModalOpen(true) }
  const handleSubmit = async (e) => { e.preventDefault(); if (editing) await updateInvestor(editing.id, form); else await addInvestor(form); setModalOpen(false) }
  const handleDelete = async (id) => { if (window.confirm('Delete this investor?')) await deleteInvestor(id) }
  const filtered = investors.filter((i) => i.name?.toLowerCase().includes(search.toLowerCase()))

  const avatarColors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Investors</h1>
          <p className="text-sm text-gray-400 mt-1">{investors.length} total</p>
        </div>
        <button onClick={openAdd} style={btnPrimary}><Plus size={16} /> Add</button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search investors..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...input, paddingLeft: '40px' }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No investors found" description={investors.length === 0 ? "Add investors to track contributions" : "Try a different search"}
          action={investors.length === 0 && <button onClick={openAdd} style={btnPrimary}>Add Investor</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv, idx) => {
            const invAllocs = allocations.filter((a) => a.investorId === inv.id)
            const total = invAllocs.reduce((s, a) => s + (Number(a.amount) || 0), 0)
            const color = avatarColors[idx % avatarColors.length]
            return (
              <div key={inv.id} style={card}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{
                      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                      boxShadow: `0 4px 12px ${color}30`,
                    }}>
                      <span className="text-white font-bold text-sm">{inv.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{inv.name}</h3>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {inv.email && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Mail size={10} /> {inv.email}</span>}
                        {inv.phone && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Phone size={10} /> {inv.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => openEdit(inv)} className="p-2 rounded-xl hover:bg-gray-50 transition"><Pencil size={14} className="text-gray-300" /></button>
                    <button onClick={() => handleDelete(inv.id)} className="p-2 rounded-xl hover:bg-red-50 transition"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                  <span className="text-xs text-gray-400 font-medium">{invAllocs.length} project{invAllocs.length !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-sm text-gray-900">{formatCurrency(total)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Investor' : 'New Investor'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label style={labelStyle}>Name *</label><input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} placeholder="e.g. John Doe" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></div>
            <div><label style={labelStyle}>Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} /></div>
          </div>
          <div><label style={labelStyle}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...input, minHeight: '60px', resize: 'vertical' }} placeholder="e.g. Prefers short-term projects" /></div>
          <button type="submit" style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>{editing ? 'Save Changes' : 'Add Investor'}</button>
        </form>
      </Modal>
    </div>
  )
}
