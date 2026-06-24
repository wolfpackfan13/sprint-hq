// Takes calendar events + the user's companies/projects, asks Claude to:
//  - decide which events are meeting-like / prep-worthy (skip lunch, gym, focus blocks)
//  - propose a prep task for each
//  - match each to the best client + project from the user's actual lists
// Returns an array of proposals for the user to review.

export async function matchCalendarToTasks({ events, companies, projects, apiKey }) {
  if (!events || events.length === 0) return []

  const companyList = companies.map(c => `- id:"${c.id}" name:"${c.name}"`).join('\n')
  const projectList = projects
    .filter(p => p.status === 'active')
    .map(p => `- id:"${p.id}" name:"${p.name}" client:"${p.companyId}"`).join('\n')

  const eventList = events.map((e, i) =>
    `${i}. "${e.title}"${e.attendees?.length ? ` | attendees: ${e.attendees.slice(0,5).join(', ')}` : ''}${e.description ? ` | notes: ${e.description.slice(0,120)}` : ''} | ${e.allDay ? 'all-day' : new Date(e.start).toLocaleString('en-US', { weekday:'short', hour:'numeric', minute:'2-digit' })}`
  ).join('\n')

  const prompt = `You are helping a busy multi-business entrepreneur prepare for their day from their calendar.

THEIR CLIENTS/COMPANIES:
${companyList || '(none)'}

THEIR ACTIVE PROJECTS:
${projectList || '(none)'}

CALENDAR EVENTS:
${eventList}

For each event that is a real MEETING or commitment that would benefit from preparation, propose a short prep task. SKIP events that need no prep: lunch, gym, personal appointments, focus/work blocks, commute, breaks, blocked time, holidays.

For each prep-worthy event, match it to the most likely client (companyId) and project (projectId) based on the title, attendees, and your knowledge of their business. If you can't confidently match a project, leave projectId null. If you can't match a client, leave companyId null.

Respond with ONLY a JSON array, no markdown, no preamble. Each item:
{"eventIndex": <number>, "taskTitle": "Prep for X / Review Y", "companyId": "<id or null>", "projectId": "<id or null>", "reason": "<3-6 word why>"}

Only include prep-worthy events. If none qualify, return [].`

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
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Calendar matching failed')
  }

  const data = await response.json()
  let text = data.content[0]?.text || '[]'
  text = text.replace(/```json|```/g, '').trim()

  let proposals
  try { proposals = JSON.parse(text) } catch { return [] }
  if (!Array.isArray(proposals)) return []

  // Attach the source event back to each proposal
  return proposals
    .filter(p => typeof p.eventIndex === 'number' && events[p.eventIndex])
    .map(p => ({
      ...p,
      event: events[p.eventIndex],
      dueDate: events[p.eventIndex].start ? events[p.eventIndex].start.split('T')[0] : null,
      accepted: true, // default checked for review
    }))
}
