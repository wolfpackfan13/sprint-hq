import { useState } from 'react'
import { Search } from 'lucide-react'
import { Sheet, Avatar } from './bits'
import { STAGES, stageOf, emailsOf, mergePatch, referralStageOf, REFERRAL_STAGES, duplicatesOf, lower, moreCurrentStage } from '../../utils/relationships'

// Which record to keep by default: the one further along (a lead or
// client over a network contact, anyone over Needs review), then the older.
function defaultKeep(a, b) {
  if (stageOf(a) !== stageOf(b)) return moreCurrentStage(a, b) === stageOf(a) ? a.id : b.id
  if (!a.createdAt || !b.createdAt) return a.createdAt ? a.id : b.createdAt ? b.id : a.id
  return a.createdAt <= b.createdAt ? a.id : b.id
}

function PersonCard({ person, kept, onPick, name }) {
  return (
    <label className={`flex gap-3 items-start p-3 rounded-xl border cursor-pointer ${kept ? 'border-gold-500 bg-gold-50' : 'border-surface-300'}`}>
      <input type="radio" name={name} checked={kept} onChange={onPick} className="mt-1 w-4 h-4 accent-[#A86800]" />
      <Avatar contact={person} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy-900 truncate">{person.name || person.email}</span>
        <span className="block text-xs text-navy-600 truncate">{emailsOf(person).join(', ') || 'No email'}</span>
        <span className="block text-xs text-navy-600">{STAGES[stageOf(person)].label}{person.company ? ` · ${person.company}` : ''}</span>
      </span>
    </label>
  )
}

// Two records for one person become one. Every email address is kept, and
// meetings, email threads, tasks and referrals from both point to the one
// that stays.
export function MergeSheet({ contact, candidate, contacts, onMerge, onClose }) {
  const [other, setOther] = useState(candidate || null)
  const [query, setQuery] = useState('')
  const [keepId, setKeepId] = useState(candidate ? defaultKeep(contact, candidate) : contact.id)

  const suggestions = duplicatesOf(contact, contacts)
  const q = lower(query)
  const results = q
    ? contacts.filter(c => c.id !== contact.id && [c.name, c.company, ...emailsOf(c)].some(v => lower(v).includes(q))).slice(0, 6)
    : suggestions.slice(0, 6)

  const pick = (c) => { setOther(c); setKeepId(defaultKeep(contact, c)) }

  if (!other) {
    return (
      <Sheet title={`Merge ${contact.name || 'this person'} with…`} subtitle="Pick the other record for the same person." onClose={onClose} labelId="merge-pick-title"
        footer={<button onClick={onClose} className="w-full py-3 btn-ghost text-sm">Cancel</button>}>
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500 pointer-events-none" aria-hidden="true" />
            <label htmlFor="merge-search" className="sr-only">Search people</label>
            <input id="merge-search" value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search name, company or email"
              className="w-full input-base pl-9 pr-3 py-2.5 text-sm" />
          </div>
          {!q && suggestions.length > 0 && <p className="text-xs font-semibold text-navy-600">Looks like the same person</p>}
          <ul className="space-y-1">
            {results.map(c => (
              <li key={c.id}>
                <button onClick={() => pick(c)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left hover:bg-surface-100 min-h-[48px]">
                  <Avatar contact={c} size={28} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-navy-900 truncate">{c.name || c.email}</span>
                    <span className="block text-xs text-navy-600 truncate">{[emailsOf(c)[0], c.company].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {q && results.length === 0 && <p className="text-sm text-navy-500">Nobody matches.</p>}
        </div>
      </Sheet>
    )
  }

  const keep = keepId === contact.id ? contact : other
  const drop = keepId === contact.id ? other : contact
  const result = { ...keep, ...mergePatch(keep, drop) }
  const ref = referralStageOf(result)

  return (
    <Sheet title="Merge into one person" subtitle="Choose which record stays. Nothing is lost from the other." onClose={onClose} labelId="merge-title" wide
      footer={
        <div className="flex gap-2">
          <button onClick={() => (candidate ? onClose() : setOther(null))} className="flex-1 py-3 btn-ghost text-sm">{candidate ? 'Cancel' : 'Back'}</button>
          <button onClick={() => onMerge(keep.id, drop.id)} className="flex-[2] py-3 btn-primary text-sm">Merge</button>
        </div>
      }>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-navy-600 mb-1.5">Keep</legend>
          <PersonCard person={contact} kept={keepId === contact.id} onPick={() => setKeepId(contact.id)} name="merge-keep" />
          <PersonCard person={other} kept={keepId === other.id} onPick={() => setKeepId(other.id)} name="merge-keep" />
        </fieldset>
        <div className="rounded-xl bg-surface-100 px-3.5 py-3 space-y-1.5 text-sm">
          <p className="text-xs font-semibold text-navy-600">After the merge</p>
          <p><span className="text-navy-600">Name</span> <span className="font-semibold text-navy-900">{result.name}</span></p>
          <p><span className="text-navy-600">Emails</span> <span className="text-navy-900">{emailsOf(result).join(', ') || 'None'}</span></p>
          <p><span className="text-navy-600">Stage</span> <span className="text-navy-900">{STAGES[stageOf(result)].label}{ref ? ` · ${REFERRAL_STAGES[ref].label}` : ''}</span></p>
          <p className="text-xs text-navy-600 pt-1">Meetings, email, tasks and referrals from both move to {result.name || 'this person'}. Gmail sync and Circleback match either address from now on.</p>
        </div>
      </div>
    </Sheet>
  )
}
