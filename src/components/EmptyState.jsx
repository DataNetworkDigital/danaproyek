export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-primary-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  )
}
