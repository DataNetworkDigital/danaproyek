export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getStatusColor(status) {
  switch (status) {
    case 'active':
      return 'bg-success-50 text-success-600'
    case 'completed':
      return 'bg-primary-50 text-primary-600'
    case 'paused':
      return 'bg-warning-50 text-warning-600'
    case 'cancelled':
      return 'bg-danger-50 text-danger-600'
    case 'paid':
      return 'bg-success-50 text-success-600'
    case 'pending':
      return 'bg-warning-50 text-warning-600'
    case 'overdue':
      return 'bg-danger-50 text-danger-600'
    default:
      return 'bg-gray-50 text-gray-600'
  }
}
