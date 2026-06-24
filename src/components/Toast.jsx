import { useEffect } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'

export function Toast({ toast, onAction, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, toast.duration || 5000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-[pop-in_0.2s_ease]">
      <div className="bg-navy-900 text-white rounded-xl shadow-modal px-4 py-3 flex items-center gap-3 min-w-[260px]">
        <div className="w-5 h-5 rounded-full bg-forest-500 flex items-center justify-center flex-shrink-0">
          <Check size={12} className="text-white" strokeWidth={3} />
        </div>
        <span className="text-sm flex-1">{toast.message}</span>
        {toast.actionLabel && (
          <button onClick={onAction} className="flex items-center gap-1 text-sm font-display font-semibold text-gold-400 hover:text-gold-300 transition-colors flex-shrink-0">
            <RotateCcw size={13} /> {toast.actionLabel}
          </button>
        )}
        <button onClick={onDismiss} className="text-navy-400 hover:text-white transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
