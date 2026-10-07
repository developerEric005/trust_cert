import type { Status, VerifyResponse } from '../types'

const EXPLORER = import.meta.env.VITE_EXPLORER_URL ?? 'https://amoy.polygonscan.com/tx/'

const PATHS: Record<Status, string> = {
  verified: 'M6 12.5l4 4 8-9',
  mismatch: 'M12 7v6M12 17h.01',
  not_found: 'M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1 1-1.1 1.8M12 17.5h.01',
  unaccredited: 'M7 7l10 10M17 7L7 17',
  revoked: 'M6.7 6.7l10.6 10.6',
}

const LOOK: Record<Status, { title: string; blurb: string; box: string; text: string; dot: string }> = {
  verified: { title: 'Verified', blurb: 'This record matches what the university anchored on-chain.', box: 'border-green-500 bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  mismatch: { title: 'Mismatch', blurb: 'A record exists, but these details do not match it.', box: 'border-amber-500 bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  not_found: { title: 'Not found', blurb: 'No record with this serial number for this university.', box: 'border-slate-400 bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
  revoked: { title: 'Revoked', blurb: 'The university has withdrawn this certificate.', box: 'border-red-500 bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  unaccredited: { title: 'Unaccredited institution', blurb: 'This institution is not on the CUE-recognised list.', box: 'border-red-500 bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
}

export default function ResultCard({ r }: { r: VerifyResponse }) {
  const look = LOOK[r.status]
  return (
    <div className={`space-y-3 rounded-2xl border-2 p-4 ${look.box}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${look.dot}`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {r.status === 'revoked' && <circle cx="12" cy="12" r="7.5" />}
            <path d={PATHS[r.status]} />
          </svg>
        </span>
        <h2 className={`text-xl font-bold ${look.text}`}>{look.title}</h2>
      </div>
      <p className="text-slate-700">{look.blurb}</p>

      {r.university && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <b className="text-navy-900">{r.university.name}</b>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${r.university.accredited ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {r.university.accredited ? 'Accredited' : 'Not accredited'}
          </span>
        </div>
      )}

      {r.mismatchedFields.length > 0 && (
        <p className="text-sm">Differs in:{' '}
          {r.mismatchedFields.map((f) => (
            <span key={f} className="mr-1 rounded-lg bg-amber-400 px-2 py-0.5 font-semibold text-navy-950">{f.replace(/_/g, ' ')}</span>
          ))}
        </p>
      )}

      {r.txHash && (
        <p className="break-all text-sm text-slate-700">
          Anchored {r.anchoredAt ? new Date(r.anchoredAt).toLocaleString() : ''}
          <br />
          <a className="font-semibold text-teal-700 underline" href={EXPLORER + r.txHash} target="_blank" rel="noreferrer">View on Polygon explorer</a>
        </p>
      )}

      {r.aiRisk && (
        <div className="rounded-xl bg-white p-3 text-sm">
          <b className="text-navy-900">AI risk signal: {Math.round(r.aiRisk.score * 100)}%</b>
          <p className="mt-1 text-slate-700">{r.aiRisk.notes}</p>
          <p className="mt-1 text-xs text-slate-500">A signal to prompt a closer look, not proof.</p>
        </div>
      )}
    </div>
  )
}
