import { useState, useEffect } from 'react'
import { storage } from '../utils/storage'
import { Eye, EyeOff, Check, CloudUpload, Link, Unlink, AlertCircle, RefreshCw } from 'lucide-react'
import { ManageClients } from '../components/ManageClients'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function syncedAt(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `today at ${time}` : `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
}

// The hourly Gmail sync: what it last did, and Sync now.
function EmailSyncStatus({ google }) {
  const srv = google.server
  const last = srv.lastSync
  const counts = last?.counts || {}
  const busy = google.syncResult?.status === 'busy'
  const callFailed = google.syncResult && !['ok', 'busy', 'reauth_needed', 'error'].includes(google.syncResult.status)
    ? google.syncResult.error : null

  let line, isError = false
  if (!srv.gmail) {
    line = 'Off. Gmail was left unticked when Google was connected. Tap Reconnect Google above and tick Gmail.'
    isError = true
  } else if (google.syncing) {
    line = srv.backfillDone ? 'Syncing…' : 'Reading your recent email for the first time. This can take a minute.'
  } else if (callFailed) {
    line = callFailed
    isError = true
  } else if (!last?.at) {
    line = 'First sync runs within the hour, or tap Sync now.'
  } else if (last.status === 'error' || last.status === 'reauth_needed') {
    line = `Last sync ${syncedAt(last.at)} didn't finish: ${last.error || 'unknown error'}`
    isError = true
  } else {
    const news = [
      counts.threads ? `${plural(counts.threads, 'thread')} updated` : '',
      counts.needsReview ? `${counts.needsReview} new in Needs review` : '',
    ].filter(Boolean).join(' · ')
    line = `Last synced ${syncedAt(last.at)}${news ? ` · ${news}` : ' · nothing new'}`
    if (counts.partial) line += '. Still reading older email; it continues next hour.'
  }

  return (
    <div className="mt-4 pt-4 border-t border-surface-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-900">Email sync</p>
          <p className="text-xs text-navy-500">Every hour. Reads who, when and subject only, never message text.</p>
        </div>
        <button onClick={google.syncNow} disabled={google.syncing || !srv.gmail}
          className="flex items-center gap-1.5 btn-ghost px-3 py-2 text-sm flex-shrink-0 min-h-[40px] disabled:opacity-50">
          <RefreshCw size={14} className={google.syncing ? 'animate-spin' : ''} /> {google.syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <p className={`text-xs mt-2 ${isError ? 'text-red-600' : 'text-navy-600'}`} aria-live="polite">{line}</p>
      {busy && <p className="text-xs text-navy-600 mt-1">The hourly sync is already running. Its result shows here when it finishes.</p>}
    </div>
  )
}

// Which notetakers SprintHQ takes calls from. Off means the meeting
// processor ignores that notetaker's calls: no meeting, no tasks, no new
// people. Which meetings a notetaker joins is set in the notetaker itself.
const NOTETAKERS = [
  { key: 'circleback', name: 'Circleback' },
  { key: 'fathom', name: 'Fathom' },
]

// Kept in its own synced key, not in settings, so another device saving
// its settings can't flip a switch back.
function MeetingSources() {
  const [sources, setSources] = useState(() => storage.get('meetingSources', null) || {})
  useEffect(() => {
    const onChange = (e) => { if (e.detail?.key === 'meetingSources') setSources(e.detail.next || {}) }
    window.addEventListener('sprintHQ:changed', onChange)
    return () => window.removeEventListener('sprintHQ:changed', onChange)
  }, [])
  const isOn = (k) => sources[k] !== false
  const set = (k, on) => {
    const next = { ...sources, [k]: on }
    setSources(next)
    storage.set('meetingSources', next)
  }
  return (
    <div className="card p-5">
      <p className="font-display font-semibold text-navy-900">Meeting notes</p>
      <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">
        Calls from these notetakers become meetings, tasks and Needs review people. Turn one off and SprintHQ ignores its calls.
        Which meetings each one joins is set in that notetaker. If both record the same call, it's saved once.
      </p>
      <div className="mt-3 divide-y divide-surface-200">
        {NOTETAKERS.map(n => (
          <label key={n.key} className="flex items-center justify-between gap-3 py-2.5 cursor-pointer min-h-[44px]">
            <span className="text-sm font-medium text-navy-900">{n.name}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-navy-600">{isOn(n.key) ? 'On' : 'Off'}</span>
              <input type="checkbox" role="switch" aria-label={`Take calls from ${n.name}`} checked={isOn(n.key)}
                onChange={e => set(n.key, e.target.checked)} className="w-4 h-4 accent-[#A86800]" />
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function Settings({ settings, saveSettings, google, onBackup, companies, onAddCompany, onUpdateCompany, onDeleteCompany }) {
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId || '')
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicKey || '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [backupStatus, setBackupStatus] = useState(null)

  const handleSave = () => {
    saveSettings({ googleClientId, anthropicKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const [backupError, setBackupError] = useState(null)

  const srv = google.server || {}
  const linked = !!settings.googleConnected || !!srv.connected
  const account = srv.email || settings.googleEmail
  // Linked the one-hour way while the server sign-in is available.
  const upgradeAvailable = linked && srv.available && !srv.connected

  const handleBackup = async () => {
    setBackupStatus('running')
    setBackupError(null)
    const result = await onBackup()
    setBackupStatus(result.success ? 'success' : 'error')
    if (!result.success) setBackupError(result.error || null)
    setTimeout(() => setBackupStatus(null), 3000)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-5 pb-8 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl">Settings</h1>
          <p className="text-navy-500 text-sm mt-0.5">Connect Google and enable AI features</p>
        </div>

        {/* Manage Clients */}
        <ManageClients companies={companies} onAdd={onAddCompany} onUpdate={onUpdateCompany} onDelete={onDeleteCompany} />

        {/* Google Integration */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <span className="text-base">🔗</span>
            </div>
            <div>
              <p className="font-display font-semibold text-navy-900">Google Integration</p>
              <p className="text-xs text-navy-500">Calendar, Drive backup, email sync</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">
              Google OAuth Client ID
            </label>
            <input
              type="text"
              value={googleClientId}
              onChange={e => setGoogleClientId(e.target.value)}
              placeholder="xxx.apps.googleusercontent.com"
              className="w-full input-base px-4 py-2.5 text-sm font-mono"
            />
            <p className="text-xs text-navy-400 mt-1.5">
              Get this from{' '}
              <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
                className="text-blue-500 underline">console.cloud.google.com</a>
              {' '}→ APIs & Services → Credentials
            </p>
          </div>

          {googleClientId && (
            <div className="flex flex-wrap items-center gap-2">
              {(!linked || google.reconnectNeeded || upgradeAvailable) && (
                <button onClick={() => {
                  // Save the Client ID and open Google's window in this same
                  // tap. A timer here makes phone browsers block the window.
                  saveSettings({ googleClientId, anthropicKey })
                  google.connect(googleClientId)
                }}
                  disabled={google.signingIn}
                  className="flex items-center gap-2 px-4 py-2 text-sm btn-primary">
                  <Link size={14} />
                  {google.signingIn ? 'Opening…'
                    : !linked ? 'Connect Google'
                    : google.reconnectNeeded ? 'Reconnect Google'
                    : 'Turn on email sync'}
                </button>
              )}
              {linked && !srv.connected && !srv.available && google.needsRenewal && (
                <button onClick={google.renew} disabled={google.signingIn}
                  className="flex items-center gap-2 px-4 py-2 text-sm btn-primary">
                  <Link size={14} /> {google.signingIn ? 'Opening…' : 'Refresh Google'}
                </button>
              )}
              {linked && (
                <button onClick={google.disconnect}
                  className="flex items-center gap-2 px-4 py-2 text-sm btn-ghost text-red-500 border-red-200 hover:bg-red-50">
                  <Unlink size={14} /> Disconnect Google
                </button>
              )}
              {linked && !google.needsRenewal && (
                <span className="flex items-center gap-1 text-xs text-forest-600 font-medium">
                  <Check size={12} /> Connected{account ? ` as ${account}` : ''}
                </span>
              )}
              {linked && google.needsRenewal && !google.reconnectNeeded && (
                <span className="text-xs text-navy-500">Linked. Sign-ins last an hour; one tap renews it.</span>
              )}
            </div>
          )}

          {upgradeAvailable && (
            <p className="mt-2 text-xs text-navy-600">
              Connect once more to stay signed in to Google on every device, and to sync email to Relationships every hour.
            </p>
          )}
          {srv.connected && !srv.reauth && (
            <p className="mt-2 text-xs text-navy-600">Stays signed in on every device where you use SprintHQ.</p>
          )}

          {google.authError && (
            <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {google.authError}
            </p>
          )}

          {srv.connected && <EmailSyncStatus google={google} />}

          {linked && (
            <div className="mt-4 pt-4 border-t border-surface-200">
              <button
                onClick={handleBackup}
                disabled={backupStatus === 'running'}
                className="flex items-center gap-2 text-sm btn-ghost px-4 py-2"
              >
                <CloudUpload size={14} />
                {backupStatus === 'running' ? 'Backing up...'
                  : backupStatus === 'success' ? '✓ Backed up!'
                  : backupStatus === 'error' ? 'Backup failed'
                  : 'Backup to Google Drive'}
              </button>
              <p className="text-xs text-navy-400 mt-1">Saves a JSON snapshot of all your data</p>
              {backupError && <p className="text-xs text-red-600 mt-1">{backupError}</p>}
            </div>
          )}
        </div>

        {/* Meeting notes: which notetakers SprintHQ takes calls from */}
        <MeetingSources />

        {/* Demo mode: safe to screen-share Relationships with a client */}
        <div className="card p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={!!settings.demoMode} onChange={e => saveSettings({ demoMode: e.target.checked })}
              className="mt-1 w-4 h-4 accent-[#A86800] flex-shrink-0" />
            <span>
              <span className="block font-display font-semibold text-navy-900">Demo mode</span>
              <span className="block text-xs text-navy-600 mt-0.5 leading-relaxed">
                Hides contacts labeled Personal and masks profile notes, meeting summaries, email subjects, and next touch reasons.
                Names, stages, and dates stay visible. Turns on and off instantly.
              </span>
            </span>
          </label>
        </div>

        {/* Anthropic API */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center">
              <span className="text-base">✨</span>
            </div>
            <div>
              <p className="font-display font-semibold text-navy-900">AI Briefing</p>
              <p className="text-xs text-navy-500">Powered by Claude for gap analysis</p>
            </div>
          </div>

          <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">
            Anthropic API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full input-base px-4 py-2.5 pr-10 text-sm font-mono"
            />
            <button
              onClick={() => setShowKey(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-navy-400 mt-1.5">
            Get your key at{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
              className="text-blue-500 underline">console.anthropic.com</a>
            {' '}→ API Keys
          </p>
          <div className="mt-2 flex items-start gap-1.5 text-xs text-navy-400">
            <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
            Stored locally in your browser only. Never sent to any server except Anthropic.
          </div>
        </div>

        {/* Google Cloud Setup Guide */}
        <div className="card p-5 bg-surface-100 border-surface-300">
          <p className="font-display font-semibold text-navy-700 text-sm mb-3">📋 Google Cloud Setup (5 min)</p>
          <ol className="space-y-2 text-sm text-navy-600">
            <li className="flex gap-2"><span className="font-bold text-navy-400 flex-shrink-0">1.</span>Go to console.cloud.google.com → New Project</li>
            <li className="flex gap-2"><span className="font-bold text-navy-400 flex-shrink-0">2.</span>APIs & Services → Enable: Google Calendar API, Drive API, Gmail API</li>
            <li className="flex gap-2"><span className="font-bold text-navy-400 flex-shrink-0">3.</span>Credentials → Create OAuth Client ID → Web Application</li>
            <li className="flex gap-2"><span className="font-bold text-navy-400 flex-shrink-0">4.</span>Add Authorized JavaScript Origins: <code className="bg-surface-200 px-1 rounded text-xs">https://wolfpackfan13.github.io</code></li>
            <li className="flex gap-2"><span className="font-bold text-navy-400 flex-shrink-0">5.</span>Copy the Client ID and paste it above</li>
          </ol>
        </div>

        {/* Save */}
        <button onClick={handleSave} className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2">
          {saved ? <><Check size={16} /> Saved!</> : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
