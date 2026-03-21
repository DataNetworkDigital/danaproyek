import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency } from '../lib/formatters'
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
  const openEdit = (inv) => {
    setEditing(inv)
    setForm({ name: inv.name || '', email: inv.email || '', phone: inv.phone || '', notes: inv.notes || '' })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) await updateInvestor(editing.id, form)
    else await addInvestor(form)
    setModalOpen(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this investor?')) await deleteInvestor(id)
  }

  const filtered = investors.filter((i) =>
    i.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investors</h1>
          <p className="text-sm text-gray-500 mt-1">{investors.length} total</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search investors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No investors found"
          description={investors.length === 0 ? "Add investors to track their contributions" : "Try a different search"}
          action={investors.length === 0 && <button onClick={openAdd} className="btn-primary text-sm">Add Investor</button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const invAllocs = allocations.filter((a) => a.investorId === inv.id)
            const totalInvested = invAllocs.reduce((s, a) => s + (Number(a.amount) || 0), 0)

            return (
              <div key={inv.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-sm">
                        {inv.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{inv.name}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {inv.email && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail size={10} /> {inv.email}
                          </span>
                        )}
                        {inv.phone && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone size={10} /> {inv.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(inv)} className="p-2 rounded-lg hover:bg-gray-100 transition">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(inv.id)} className="p-2 rounded-lg hover:bg-red-50 transition">
                      <Trash2 size={14} className="text-gray-400 hover:text-danger-500" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{invAllocs.length} project{invAllocs.length !== 1 ? 's' : ''}</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(totalInvested)}</span>
                </div>
                {inv.notes && <p className="text-xs text-gray-400 mt-2">{inv.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Investor' : 'New Investor'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
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
              placeholder="e.g. Friend from college, prefers short-term projects"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {editing ? 'Save Changes' : 'Add Investor'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
