import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency, formatDate, daysUntil, getStatusColor } from '../lib/formatters'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { CalendarClock, Plus, Pencil, Trash2, Check, Clock, AlertTriangle } from 'lucide-react'

const defaultForm = {
  projectId: '',
  investorId: '',
  amount: '',
  dueDate: '',
  type: 'return',
  status: 'pending',
  notes: '',
}

export default function Payments() {
  const {
    payments, projects, investors,
    addPayment, updatePayment, deletePayment,
  } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [filter, setFilter] = useState('all')

  const openAdd = () => { setEditing(null); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      projectId: p.projectId || '',
      investorId: p.investorId || '',
      amount: p.amount || '',
      dueDate: p.dueDate || '',
      type: p.type || 'return',
      status: p.status || 'pending',
      notes: p.notes || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) await updatePayment(editing.id, form)
    else await addPayment(form)
    setModalOpen(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this payment?')) await deletePayment(id)
  }

  const markPaid = async (payment) => {
    await updatePayment(payment.id, { status: 'paid', paidDate: new Date().toISOString().split('T')[0] })
  }

  // Compute effective statuses
  const enriched = payments.map((p) => {
    const days = daysUntil(p.dueDate)
    const effectiveStatus = p.status === 'pending' && days < 0 ? 'overdue' : p.status
    return { ...p, effectiveStatus, daysUntil: days }
  })

  const filtered = filter === 'all'
    ? enriched
    : enriched.filter((p) => p.effectiveStatus === filter)

  const totals = {
    pending: enriched.filter((p) => p.effectiveStatus === 'pending').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    overdue: enriched.filter((p) => p.effectiveStatus === 'overdue').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    paid: enriched.filter((p) => p.effectiveStatus === 'paid').reduce((s, p) => s + (Number(p.amount) || 0), 0),
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Track all payment schedules</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-3 text-center">
          <Clock size={18} className="mx-auto text-warning-500 mb-1" />
          <p className="text-xs text-gray-500">Pending</p>
          <p className="font-bold text-sm text-gray-900">{formatCurrency(totals.pending)}</p>
        </div>
        <div className="card !p-3 text-center">
          <AlertTriangle size={18} className="mx-auto text-danger-500 mb-1" />
          <p className="text-xs text-gray-500">Overdue</p>
          <p className="font-bold text-sm text-danger-600">{formatCurrency(totals.overdue)}</p>
        </div>
        <div className="card !p-3 text-center">
          <Check size={18} className="mx-auto text-success-500 mb-1" />
          <p className="text-xs text-gray-500">Paid</p>
          <p className="font-bold text-sm text-success-600">{formatCurrency(totals.paid)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'pending', 'overdue', 'paid'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              filter === s ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No payments found"
          description={payments.length === 0 ? "Add payment schedules to track due dates" : "Try a different filter"}
          action={payments.length === 0 && <button onClick={openAdd} className="btn-primary text-sm">Add Payment</button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((payment) => {
            const project = projects.find((p) => p.id === payment.projectId)
            const investor = investors.find((i) => i.id === payment.investorId)

            return (
              <div key={payment.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-gray-900">{project?.name || 'Unknown'}</h3>
                      <span className={`badge ${getStatusColor(payment.effectiveStatus)}`}>
                        {payment.effectiveStatus}
                      </span>
                      <span className="badge bg-gray-50 text-gray-500">{payment.type}</span>
                    </div>
                    {investor && (
                      <p className="text-xs text-gray-500 mt-1">To: {investor.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {payment.effectiveStatus !== 'paid' && (
                      <button
                        onClick={() => markPaid(payment)}
                        className="p-2 rounded-lg hover:bg-green-50 transition"
                        title="Mark as paid"
                      >
                        <Check size={14} className="text-success-500" />
                      </button>
                    )}
                    <button onClick={() => openEdit(payment)} className="p-2 rounded-lg hover:bg-gray-100 transition">
                      <Pencil size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(payment.id)} className="p-2 rounded-lg hover:bg-red-50 transition">
                      <Trash2 size={14} className="text-gray-400 hover:text-danger-500" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    <span>Due: {formatDate(payment.dueDate)}</span>
                    {payment.daysUntil !== null && payment.effectiveStatus === 'pending' && (
                      <span className="ml-2 text-warning-600">
                        ({payment.daysUntil === 0 ? 'Today' : `${payment.daysUntil}d left`})
                      </span>
                    )}
                    {payment.effectiveStatus === 'overdue' && (
                      <span className="ml-2 text-danger-500">
                        ({Math.abs(payment.daysUntil)}d overdue)
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-gray-900">{formatCurrency(payment.amount)}</p>
                </div>
                {payment.notes && <p className="text-xs text-gray-400 mt-2">{payment.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Payment' : 'New Payment'}>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Investor (payee)</label>
            <select
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <option value="return">Return</option>
                <option value="principal">Principal</option>
                <option value="interest">Interest</option>
                <option value="dividend">Dividend</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
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
            {editing ? 'Save Changes' : 'Add Payment'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
