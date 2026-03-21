export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style={{
        background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
      }}>
        <Icon size={28} className="text-indigo-300" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
