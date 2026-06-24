import { useState } from 'react'
import { Lock, Mail, LogIn, AlertCircle } from 'lucide-react'

export function Login({ onSignIn, authLoading }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e?.preventDefault()
    if (!email.trim() || !password) return
    setSubmitting(true); setError(null)
    const result = await onSignIn(email.trim(), password)
    if (result.error) { setError(result.error); setSubmitting(false) }
    // on success, parent re-renders into the app
  }

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-bold text-navy-900 text-2xl">S</span>
          </div>
          <h1 className="font-display font-bold text-navy-900 text-2xl">SprintHQ</h1>
          <p className="text-navy-500 text-sm mt-1">Sign in to sync across your devices</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoFocus
                className="w-full input-base pl-9 pr-4 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1.5">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full input-base pl-9 pr-4 py-2.5 text-sm" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting || !email.trim() || !password}
            className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting ? 'Signing in...' : <><LogIn size={15} /> Sign In</>}
          </button>
        </form>

        <p className="text-center text-xs text-navy-400 mt-4">
          Your data syncs securely and is private to your account
        </p>
      </div>
    </div>
  )
}
