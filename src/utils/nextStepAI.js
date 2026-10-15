import { supabase } from './supabase'
import { stageOf, referralStageOf, STAGES, REFERRAL_STAGES, whoWroteLast, localDateOf, clientHistoryLabel, hasSigned, firstNameOf, notesOf } from './relationships'
import { calUtils } from './dateUtils'

// The AI next step runs in the contact-next-step edge function, which holds
// the Anthropic key. The app sends a short brief built from what it already
// has on this device and saves the answer on the contact, with the basis it
// was built from, so it only asks again when something new happens.
//
// Function names are case-sensitive; deploy it as exactly contact-next-step.
const FN = 'contact-next-step'

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

export function buildBrief(contact, { linkedMeetings = [], linkedThreads = [], openTasks = [], booked, referrals = [], referrer, company, dismissed = [] }) {
  const first = firstNameOf(contact)
  const stamp = (d) => d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const bookedAt = booked?.start ? new Date(booked.start) : null
  return {
    today: calUtils.localToday(),
    // The time matters: a meeting "today" may already be over.
    now: stamp(new Date()),
    person: {
      name: contact.name || contact.email || '',
      role: contact.role || '',
      company: contact.company || company?.name || '',
      businessStage: STAGES[stageOf(contact)]?.label || '',
      referralStage: REFERRAL_STAGES[referralStageOf(contact)]?.label || 'None',
      clientHistory: clientHistoryLabel(contact),
      profile: clip(contact.notes, 900),
      referredBy: referrer?.name || '',
      suggestedFollowUp: !contact.nextTouchEventId && contact.nextTouchOn
        ? { date: contact.nextTouchOn, reason: clip(contact.nextTouchReason, 160) } : null,
      referralTerms: clip(contact.referralTerms, 300),
    },
    // The next step Sam set himself, if any; suggestions should fit with it.
    samsOwnNextStep: contact.nextStep?.mine?.title ? { title: clip(contact.nextStep.mine.title, 160), by: contact.nextStep.mine.due || '' } : null,
    // Sam's own notes on them, newest first.
    notes: notesOf(contact).slice(0, 8).map(n => ({ date: localDateOf(n.at), text: clip(n.text, 400) })),
    // Only meetings still ahead count as booked; ones already logged are in meetings.
    booked: booked ? {
      title: booked.title,
      when: bookedAt && booked.start.includes('T') ? stamp(bookedAt) : booked.start,
      startsInHours: bookedAt ? Math.round(((bookedAt.getTime() - Date.now()) / 3600000) * 10) / 10 : null,
    } : null,
    meetings: linkedMeetings.slice(0, 6).map(m => ({
      date: m.date, title: clip(m.title, 120), source: m.source || 'manual',
      summary: clip(m.summary || m.notes, 700),
      openActionItems: (m.actionItems || []).filter(ai => !ai.done).slice(0, 5).map(ai => clip(ai.title, 140)),
    })),
    emails: linkedThreads.slice(0, 8).map(t => ({
      id: t.id,
      date: localDateOf(t.lastMessageAt), subject: clip(t.subject, 140),
      lastWriter: whoWroteLast(t, first), messages: t.messageCount || 1,
    })),
    openTasks: openTasks.slice(0, 8).map(t => ({ title: clip(t.title, 140), due: t.dueDate || '' })),
    referrals: referrals.slice(0, 8).map(r => ({
      name: r.name, stage: STAGES[stageOf(r)]?.label || '', signed: hasSigned(r),
      rewardPaid: !!r.rewardPaidOn,
    })),
    dismissed: dismissed.slice(-8),
  }
}

// { ok: true, summary, steps } or { ok: false, code, error }.
// code 'not_deployed' means the function isn't in Supabase yet; the page
// then keeps its rule-based suggestion and stops asking this session.
export async function fetchNextStep(brief) {
  try {
    const { data, error } = await supabase.functions.invoke(FN, { body: { brief } })
    if (error) {
      let payload = null
      try { payload = await error.context?.json?.() } catch { payload = null }
      // A function that isn't deployed fails the browser's CORS check
      // before any status comes back, so that reads as 'unreachable' while
      // the device is online.
      const online = typeof navigator === 'undefined' || navigator.onLine !== false
      const code = payload?.code === 'NOT_FOUND' || error.context?.status === 404 ? 'not_deployed'
        : payload?.code || (error.name === 'FunctionsFetchError' ? (online ? 'unreachable' : 'offline') : 'error')
      return { ok: false, code, error: payload?.error || error.message }
    }
    if (!data?.ok) return { ok: false, code: data?.code || 'error', error: data?.error || 'No suggestion came back.' }
    return { ok: true, summary: data.summary || '', steps: Array.isArray(data.steps) ? data.steps : [] }
  } catch (err) {
    return { ok: false, code: 'offline', error: err.message }
  }
}
