import { useState } from 'react'
import { Eye, EyeOff, Check, CloudUpload, Link, Unlink, AlertCircle } from 'lucide-react'
import { ManageClients } from '../components/ManageClients'

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

  const handleBackup = async () => {
    setBackupStatus('running')
    const result = await onBackup()
    setBackupStatus(result.success ? 'success' : 'error')
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
              <p className="text-xs text-navy-500">Calendar, Drive backup, Gmail scan</p>
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
            <div className="flex gap-2">
              {settings.googleConnected ? (
                <button onClick={google.disconnect}
                  className="flex items-center gap-2 px-4 py-2 text-sm btn-ghost text-red-500 border-red-200 hover:bg-red-50">
                  <Unlink size={14} /> Disconnect Google
                </button>
              ) : (
                <button onClick={google.connect}
                  className="flex items-center gap-2 px-4 py-2 text-sm btn-primary">
                  <Link size={14} /> Connect Google
                </button>
              )}
              {settings.googleConnected && (
                <span className="flex items-center gap-1 text-xs text-forest-600 font-medium">
                  <Check size={12} /> Connected
                </span>
              )}
            </div>
          )}

          {settings.googleConnected && (
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
            </div>
          )}
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
