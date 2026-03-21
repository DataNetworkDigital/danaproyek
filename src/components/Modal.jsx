import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md max-h-[90dvh] overflow-auto"
        style={{
          background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '24px',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <style>{`
          @media (min-width: 640px) {
            .relative.w-full { border-radius: 24px !important; }
          }
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
