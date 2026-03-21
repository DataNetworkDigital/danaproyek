import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { formatCurrency, formatDate, daysUntil } from '../lib/formatters'
import { card, btnPrimary, badge, input, label as labelStyle } from '../lib/styles'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { CalendarClock, Plus, Pencil, Trash2, Check, Clock, AlertTriangle } from 'lucide-react'

const defaultForm = { projectId: '', investorId: '', amount: '', dueDate: '', type: 'return', status: 'pending', notes: '' }

export default function Payments() {
  const { payments, projects, investors, addPayment, updatePayment, deletePayment } = useData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [filter, setFilter] = useState('all')

  const openAdd = () => { setEditing(null); setForm(defaultForm); setModalOpen(true) }
  const openEdit = (p) => { setEditing(p); setForm({ projectId: p.projectId || '', investorId: p.investorId || '', amount: p.amount || '', dueDate: p.dueDate || '', type: p.type || 'return', status: p.status || 'pending', notes: p.notes || '' }); setModalOpen(true) }
  const handleSubmit = async (e) => { e.preventDefault(); if (editing) await updatePayment(editing.id, form); else await addPayment(form); setModalOpen(false) }
  const handleDelete = async (id) => { if (window.confirm('Delete?')) await deletePayment(id) }
  const markPaid = async (p) => { await updatePayment(p.id, { status: 'paid', paidDate: new Date().toISOString().split('T')[0] }) }

  const enriched = payments.map((p) => {
    const days = daysUntil(p.dueDate)
    return { ...p, effectiveStatus: p.status === 'pending' && days < 0 ? 'overdue' : p.status, daysUntil: days }
  })
  const filtered = filter === 'all' ? enriched : enriched.filter((p) => p.effectiveStatus === filter)

  const totals = {
    pending: enriched.filter((p) => p.effectiveStatus === 'pending').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    overdue: enriched.filter((p) => p.effectiveStatus === 'overdue').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    paid: enriched.filter((p) => p.effectiveStatus === 'paid').reduce((s, p) => s + (Number(p.amount) || 0), 0),
  }

  const summaryCards = [
    { icon: Clock, label: 'Pending', value: totals.pending, bg: 'linear-gradient(135deg, #fef3c7, #fffbeb)', color: '#d97706', shadow: 'rgba(245,158,11,0.15)' },
    { icon: AlertTriangle, label: 'Overdue', value: totals.overdue, bg: 'linear-gradient(135deg, #fee2e2, #fef2f2)', color: '#dc2626', shadow: 'rgba(239,68,68,0.15)' },
    { icon: Check, label: 'Paid', value: totals.paid, bg: 'linear-gradient(135deg, #d1fae5, #ecfdf5)', color: '#059669', shadow: 'rgba(16,185,129,0.15)' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-400 mt-1">Track payment schedules</p>
        </div>
        <button onClick={openAdd} style={btnPrimary}><Plus size={16} /> Add</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map(({ icon: Icon, label, value, bg, color, shadow }) => (
          <div key={label} className="text-center p-3 rounded-2xl" style={{ background: bg, boxShadow: `0 2px 8px ${shadow}` }}>
            <Icon size={20} className="mx-auto mb-1" style={{ color }} />
            <p className="text-[10px] font-semibold text-gray-500 uppercase">{label}</p>
            <p className="font-bold text-sm mt-0.5" style={{ color }}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {['all', 'pending', 'overdue', 'paid'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={filter === s ? { ...btnPrimary, fontSize: '12px', padding: '8px 16px' } : { background: 'white', color: '#6b7280', fontWeight: 600, fontSize: '12px', padding: '8px 16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No payments found" description={payments.length === 0 ? "Add payment schedules" : "Try another filter"}
          action={payments.length === 0 && <button onClick={openAdd} style={btnPrimary}>Add Payment</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((payment) => {
            const project = projects.find((p) => p.id === payment.projectId)
            const investor = investors.find((i) => i.id === payment.investorId)
            return (
              <div key={payment.id} style={card}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-gray-900">{project?.name || 'Unknown'}</h3>
                      <span style={badge(payment.effectiveStatus)}>{payment.effectiveStatus}</span>
                    </div>
                    {investor && <p className="text-[11px] text-gray-400 mt-1">To: {investor.name}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 ml-2">
                    {payment.effectiveStatus !== 'paid' && (
                      <button onClick={() => markPaid(payment)} className="p-2 rounded-xl hover:bg-green-50 transition" title="Mark paid">
                        <Check size={14} className="text-emerald-400" />
                      </button>
                    )}
                    <button onClick={() => openEdit(payment)} className="p-2 rounded-xl hover:bg-gray-50 transition"><Pencil size={14} className="text-gray-300" /></button>
                    <button onClick={() => handleDelete(payment.id)} className="p-2 rounded-xl hover:bg-red-50 transition"><Trash2 size={14} className="text-gray-300 hover:text-red-400" /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                  <div className="text-xs text-gray-400 font-medium">
                    <span>{formatDate(payment.dueDate)}</span>
                    {payment.effectiveStatus === 'pending' && payment.daysUntil !== null && (
                      <span className="ml-1.5" style={{ color: '#d97706' }}>({payment.daysUntil === 0 ? 'Today' : `${payment.daysUntil}d`})</span>
                    )}
                    {payment.effectiveStatus === 'overdue' && (
                      <span className="ml-1.5" style={{ color: '#dc2626' }}>({Math.abs(payment.daysUntil)}d late)</span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-gray-900">{formatCurrency(payment.amount)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Payment' : 'New Payment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label style={labelStyle}>Project *</label><select required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} style={input}>
            <option value="">Select project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label style={labelStyle}>Investor (payee)</label><select value={form.investorId} onChange={(e) => setForm({ ...form, investorId: e.target.value })} style={input}>
            <option value="">Select investor</option>{investors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Amount *</label><input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input} /></div>
            <div><label style={labelStyle}>Due Date *</label><input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={input} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={labelStyle}>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={input}>
              <option value="return">Return</option><option value="principal">Principal</option><option value="interest">Interest</option><option value="dividend">Dividend</option>
            </select></div>
            <div><label style={labelStyle}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
              <option value="pending">Pending</option><option value="paid">Paid</option>
            </select></div>
          </div>
          <button type="submit" style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>{editing ? 'Save Changes' : 'Add Payment'}</button>
        </form>
      </Modal>
    </div>
  )
}
