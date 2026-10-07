import { X } from 'lucide-react'
import { STAGES, stageOf } from '../../utils/relationships'

export function StageChip({ stage, className = '' }) {
  const s = STAGES[stage] || STAGES.needs_review
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.chip} ${className}`}>
      {s.label}
    </span>
  )
}

export function Avatar({ contact, company, size = 36 }) {
  const color = stageOf(contact) === 'needs_review' ? '#9BA5BB' : (company?.color || '#6B7280')
  const letter = (contact?.name || contact?.email || '?').trim()[0]?.toUpperCase() || '?'
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center text-white font-display font-bold"
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: color, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}

export function SectionLabel({ children, className = '' }) {
  return (
    <p className={`font-display font-bold text-[11px] uppercase tracking-wider text-navy-600 ${className}`}>{children}</p>
  )
}

// Bottom sheet on phones, centered dialog on desktop — the app's modal pattern.
export function Sheet({ title, subtitle, onClose, children, footer, wide = false, labelId }) {
  const id = labelId || 'sheet-title'
  return (
    <div
      className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby={id}
        className={`bg-white rounded-t-2xl md:rounded-2xl w-full ${wide ? 'md:max-w-lg' : 'md:max-w-md'} shadow-modal max-h-[92vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 flex-shrink-0">
          <div className="min-w-0">
            <h2 id={id} className="font-display font-bold text-navy-900 text-lg leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-navy-600 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 -m-1 text-navy-500 hover:text-navy-800 rounded-lg hover:bg-surface-200 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-surface-200 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
