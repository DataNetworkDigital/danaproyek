export const card = {
  background: 'white',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  border: '1px solid rgba(0,0,0,0.04)',
}

export const innerCard = {
  background: '#f8f9fc',
  borderRadius: '16px',
  padding: '14px',
}

export const btnPrimary = {
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: 'white',
  fontWeight: 600,
  fontSize: '14px',
  padding: '10px 20px',
  borderRadius: '14px',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
  transition: 'all 0.2s',
}

export const btnSecondary = {
  background: '#f3f4f6',
  color: '#6b7280',
  fontWeight: 600,
  fontSize: '12px',
  padding: '8px 14px',
  borderRadius: '12px',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s',
}

export const input = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1.5px solid #e5e7eb',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
  background: '#fafbfc',
}

export const label = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
}

export const badge = (color) => {
  const colors = {
    active: { bg: '#ecfdf5', text: '#059669' },
    completed: { bg: '#eef2ff', text: '#4f46e5' },
    paused: { bg: '#fffbeb', text: '#d97706' },
    cancelled: { bg: '#fef2f2', text: '#dc2626' },
    paid: { bg: '#ecfdf5', text: '#059669' },
    pending: { bg: '#fffbeb', text: '#d97706' },
    overdue: { bg: '#fef2f2', text: '#dc2626' },
  }
  const c = colors[color] || { bg: '#f3f4f6', text: '#6b7280' }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    background: c.bg,
    color: c.text,
    textTransform: 'capitalize',
  }
}
