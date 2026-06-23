import { useState } from 'react'
import { Sparkles, RefreshCw, AlertCircle, Calendar, Target, Zap } from 'lucide-react'
import { dateUtils } from '../utils/dateUtils'

async function runBriefing({ tasks, meetings, goals, vision, calendarEvents, emails, apiKey }) {
  const today = dateUtils.today()
  const todayTasks = tasks.filter(t => t.dueDate === today)
  const missedTasks = tasks.filter(t => t.dueDate < today && t.status === 'todo')
  const upcomingTasks = tasks.filter(t => t.dueDate > today && t.status === 'todo').slice(0, 10)
  const activeGoals = goals.filter(g => g.status === 'active')
  const recentMeetings = meetings.slice(0, 5)
  const pendingActionItems = meetings.flatMap(m =>
    (m.actionItems || []).filter(ai => !ai.done && !ai.taskId).map(ai => ({ ...ai, meetingTitle: m.title }))
  )

  const prompt = `You are a sharp executive assistant reviewing ${today}'s situation for a solo entrepreneur.

CONTEXT:
- Today: ${dateUtils.format(today, 'full')}
- Vision: ${vision || 'Not set'}

ACTIVE GOALS:
${activeGoals.map(g => `- ${g.title} (${g.timeframe})`).join('\n') || 'None set'}

TODAY'S TASKS (${todayTasks.length}):
${todayTasks.map(t => `- [${t.status}] ${t.title} (${t.priority} priority)`).join('\n') || 'None'}

MISSED/OVERDUE TASKS (${missedTasks.length}):
${missedTasks.map(t => `- ${t.title} — was due ${t.dueDate} (${dateUtils.daysOverdue(t.dueDate)} days ago)`).join('\n') || 'None'}

UPCOMING TASKS:
${upcomingTasks.map(t => `- ${t.title} — due ${t.dueDate}`).join('\n') || 'None'}

PENDING MEETING ACTION ITEMS (${pendingActionItems.length}):
${pendingActionItems.map(ai => `- "${ai.title}" from meeting: ${ai.meetingTitle}`).join('\n') || 'None'}

RECENT MEETINGS:
${recentMeetings.map(m => `- ${m.title} (${m.date}): ${(m.actionItems||[]).length} action items`).join('\n') || 'None'}

${calendarEvents.length > 0 ? `CALENDAR TODAY:\n${calendarEvents.map(ev => `- ${ev.title} at ${ev.start}`).join('\n')}` : ''}

${emails.length > 0 ? `RECENT EMAILS:\n${emails.slice(0,5).map(e => `- From: ${e.from} | ${e.subject}`).join('\n')}` : ''}

Give a SHARP, DIRECT daily briefing (no fluff). Format exactly as:

🎯 **FOCUS FOR TODAY**
[1-2 sentences on the single most important thing to accomplish today given goals]

⚡ **WHAT'S HOT**
[2-3 bullet points on the most urgent items needing attention]

⚠️ **GAPS & MISSES**
[Bullet points on things being forgotten, avoided, or falling through cracks]

📅 **CALENDAR CONFLICTS / OPPORTUNITIES**
[Any scheduling issues or opportunities noticed]

💡 **ONE INSIGHT**
[One sharp observation about patterns, blind spots, or what's misaligned with stated goals]

Be direct. Call out avoidance patterns. Reference the actual data. Max 300 words total.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'API call failed')
  }

  const data = await response.json()
  return data.content[0]?.text || ''
}

function formatBriefing(text) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('🎯') || line.startsWith('⚡') || line.startsWith('⚠️') || line.startsWith('📅') || line.startsWith('💡')) {
      return <p key={i} className="font-display font-bold text-navy-900 text-sm mt-4 mb-1 first:mt-0">{line.replace(/\*\*/g, '')}</p>
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <p key={i} className="text-sm text-navy-700 pl-3 py-0.5 border-l-2 border-surface-300 ml-1">{line.slice(2)}</p>
    }
    if (line.trim() === '') return null
    return <p key={i} className="text-sm text-navy-600 leading-relaxed">{line}</p>
  })
}

export function Briefing({ tasks, meetings, goals, vision, calendarEvents, settings, onOpenSettings }) {
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRun, setLastRun] = useState(null)

  const handleRun = async () => {
    if (!settings.anthropicKey) {
      setError('No Anthropic API key set. Add it in Settings.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const text = await runBriefing({
        tasks, meetings, goals, vision,
        calendarEvents,
        emails: [],
        apiKey: settings.anthropicKey,
      })
      setBriefing(text)
      setLastRun(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasKey = !!settings.anthropicKey

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-4 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-navy-900 text-xl flex items-center gap-2">
            <Sparkles size={20} className="text-gold-500" />
            AI Briefing
          </h1>
          <p className="text-navy-500 text-sm mt-0.5">
            {lastRun ? `Last run at ${lastRun}` : 'Daily gap analysis & focus report'}
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={loading || !hasKey}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analyzing...' : 'Run Briefing'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!hasKey && (
          <div className="card p-5 border-gold-200 bg-gold-50 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-gold-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-semibold text-navy-900 text-sm mb-1">Anthropic API key needed</p>
                <p className="text-sm text-navy-600 mb-3">The AI Briefing uses Claude to analyze your tasks, meetings, goals, and calendar to surface gaps and give you a daily focus report.</p>
                <button onClick={onOpenSettings} className="btn-primary px-4 py-2 text-sm">
                  Open Settings →
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card p-4 border-red-200 bg-red-50 mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading && (
          <div className="card p-8 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full border-2 border-gold-300 border-t-gold-600 animate-spin mb-4" />
            <p className="font-display font-semibold text-navy-700">Analyzing your day...</p>
            <p className="text-navy-400 text-sm mt-1">Reviewing tasks, meetings, goals, and calendar</p>
          </div>
        )}

        {briefing && !loading && (
          <div className="card p-5">
            <div className="text-xs font-medium text-navy-400 mb-3 flex items-center gap-1">
              <Zap size={11} className="text-gold-500" />
              Generated at {lastRun} · {dateUtils.format(dateUtils.today(), 'full')}
            </div>
            <div>{formatBriefing(briefing)}</div>
          </div>
        )}

        {!briefing && !loading && hasKey && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Sparkles size={32} className="text-gold-400 mb-3" />
            <p className="font-display font-semibold text-navy-700">Ready to brief you</p>
            <p className="text-navy-400 text-sm mt-1 max-w-xs">Hit "Run Briefing" to get your AI-powered daily focus report with gap analysis</p>
          </div>
        )}
      </div>
    </div>
  )
}
