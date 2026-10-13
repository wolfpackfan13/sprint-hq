import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Sheet } from './bits'
import { firstNameOf, gmailComposeUrl } from '../../utils/relationships'

const label = 'block text-xs font-semibold text-navy-600 mb-1.5'

function draftMessage(first, terms, idealClient) {
  const clean = (s) => s.trim().replace(/\.$/, '')
  const fit = idealClient ? ` The people I help most are ${clean(idealClient).replace(/^./, c => c.toLowerCase())}.` : ''
  const thanks = terms ? `I'd love to thank you properly: ${clean(terms)}.` : "I'd be grateful."
  return `Hi ${first},\n\nYou know a lot of business owners, and some of them could use help getting their operations in order.${fit} If you ever send one my way, ${thanks}\n\nHappy to grab coffee and walk through who's a good fit.\n\n`
}

// Invite someone into the referral partner program: terms, who to send,
// and a drafted message that opens in Gmail. Saving moves them to Invited;
// nothing sends until you send it from Gmail.
export function InviteSheet({ contact, program = {}, gmailAccount, demoMode, onInvite, onSaveProgram, onClose }) {
  const first = firstNameOf(contact)
  const [terms, setTerms] = useState(contact.referralTerms || program.terms || '')
  const [idealClient, setIdealClient] = useState(program.idealClient || '')
  const [message, setMessage] = useState(() => draftMessage(first, contact.referralTerms || program.terms || '', program.idealClient || ''))
  const [touched, setTouched] = useState(false)
  const [asDefault, setAsDefault] = useState(!program.terms)

  const refreshDraft = (t, ic) => { if (!touched) setMessage(draftMessage(first, t, ic)) }

  const send = () => {
    if (asDefault && onSaveProgram) onSaveProgram({ terms: terms.trim(), idealClient: idealClient.trim() })
    onInvite({ referralTerms: terms.trim() })
    if (contact.email) {
      window.open(gmailComposeUrl({
        to: contact.email,
        subject: 'Sending business owners my way',
        body: message,
        account: gmailAccount,
      }), '_blank', 'noopener')
    }
  }

  return (
    <Sheet
      title={`Invite ${first} as a partner`}
      subtitle={[contact.name, contact.company].filter(Boolean).join(' · ')}
      onClose={onClose} labelId="invite-title" wide
      footer={
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 btn-ghost text-sm">Cancel</button>
            <button onClick={send} className="flex-[2] py-3 btn-primary text-sm flex items-center justify-center gap-1.5">
              {contact.email ? <>Open draft in Gmail <ExternalLink size={13} /></> : 'Mark as invited'}
            </button>
          </div>
          <p className="text-xs text-navy-600 text-center">
            {contact.email ? `Moves ${first} to Invited. Nothing sends until you send it from Gmail.` : `No email saved for ${first}. This only marks them Invited.`}
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#E6DEFB] bg-[#F7F5FE] p-3.5">
          <label htmlFor="inv-terms" className="block text-xs font-semibold text-[#5B21B6] mb-1.5">What partners get</label>
          <textarea id="inv-terms" rows={2} value={demoMode && !terms ? '' : terms} onChange={e => { setTerms(e.target.value); refreshDraft(e.target.value, idealClient) }}
            placeholder="10% of the first engagement, paid when they sign" className="w-full input-base px-3 py-2 text-sm bg-white resize-none" />
          <p className="text-xs text-navy-600 mt-1.5">Saved on {first}'s page so you can see what you owe when a referral signs.</p>
        </div>
        <div>
          <label htmlFor="inv-ideal" className={label}>Who to send</label>
          <input id="inv-ideal" value={idealClient} onChange={e => { setIdealClient(e.target.value); refreshDraft(terms, e.target.value) }}
            placeholder="Service business owners with 5 to 50 people" className="w-full input-base px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label htmlFor="inv-msg" className={label}>Message</label>
          <textarea id="inv-msg" rows={8} value={message} onChange={e => { setTouched(true); setMessage(e.target.value) }}
            className="w-full input-base px-3 py-2.5 text-sm leading-relaxed resize-none" />
        </div>
        {onSaveProgram && (
          <label className="flex items-center gap-2.5 text-sm text-navy-700">
            <input type="checkbox" checked={asDefault} onChange={e => setAsDefault(e.target.checked)} className="w-4 h-4 accent-[#A86800]" />
            Use these terms and "who to send" for future invites
          </label>
        )}
      </div>
    </Sheet>
  )
}
