import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react'

export function SyncIndicator({ status, lastSynced }) {
  const config = {
    idle:    { icon: Cloud,     text: 'Synced',    color: '#9BA5BB', spin: false },
    syncing: { icon: RefreshCw, text: 'Syncing',   color: '#F4A825', spin: true },
    synced:  { icon: Check,     text: 'Synced',    color: '#2D7A50', spin: false },
    error:   { icon: CloudOff,  text: 'Sync error',color: '#EF4444', spin: false },
    offline: { icon: CloudOff,  text: 'Offline',   color: '#9BA5BB', spin: false },
  }
  const c = config[status] || config.idle
  const Icon = c.icon

  return (
    <div className="flex items-center gap-1" title={lastSynced ? `Last synced ${lastSynced.toLocaleTimeString()}` : 'Sync status'}>
      <Icon size={12} style={{ color: c.color }} className={c.spin ? 'animate-spin' : ''} />
      <span className="text-[11px] font-medium hidden lg:inline" style={{ color: c.color }}>{c.text}</span>
    </div>
  )
}
