// Only http(s) may reach an href. A 'javascript:' or 'data:' URL in a stored
// field would run on click with access to this origin's localStorage, where
// the session token and API key live. React 18 renders such links as-is.
export const safeUrl = (u) => (/^https?:\/\//i.test(String(u ?? '').trim()) ? String(u).trim() : '#')
