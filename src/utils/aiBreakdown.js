export async function breakdownTask(taskTitle, taskNotes, apiKey) {
  const prompt = `Break this task into 3-6 concrete, actionable sub-steps. Each step should be a small, clear action that can be checked off.

TASK: ${taskTitle}
${taskNotes ? `CONTEXT: ${taskNotes}` : ''}

Respond with ONLY a JSON array of strings, no preamble, no markdown fences. Example format:
["First concrete step", "Second concrete step", "Third concrete step"]

Keep each step short (under 10 words), action-oriented, starting with a verb.`

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
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Breakdown failed')
  }

  const data = await response.json()
  let text = data.content[0]?.text || '[]'
  text = text.replace(/```json|```/g, '').trim()
  try {
    const steps = JSON.parse(text)
    return Array.isArray(steps) ? steps : []
  } catch {
    // fallback: split lines
    return text.split('\n').map(l => l.replace(/^[-*\d.]+\s*/, '').trim()).filter(Boolean)
  }
}
