import { AlertTriangle } from 'lucide-react'

// Shown when changes aren't reaching Supabase, so it can't go unnoticed
// behind the small sync icon. Unsaved changes live only in this window
// until they save, so the banner says to keep it open.
export function SyncBanner({ syncError, schemaGaps = [], pending = 0 }) {
  if (!syncError && !schemaGaps.length) return null
  return (
    <div role="status" className="flex-shrink-0 flex items-start gap-2.5 px-4 py-2.5 bg-red-50 border-b border-red-200 text-[13px] text-red-800">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        {schemaGaps.length > 0 && (
          <p>
            <strong className="font-semibold">Supabase is missing {schemaGaps.join(', ')}.</strong>{' '}
            Everything else is saving, but that field won't until you run the newest migration in the Supabase SQL editor.
          </p>
        )}
        {syncError && (
          <p>
            <strong className="font-semibold">{pending > 0 ? `${pending} ${pending === 1 ? 'change hasn\'t' : 'changes haven\'t'} saved yet.` : 'Changes aren\'t saving.'}</strong>{' '}
            Keep SprintHQ open; it tries again every minute. <span className="text-red-700">Supabase said: {syncError}</span>
          </p>
        )}
      </div>
    </div>
  )
}
