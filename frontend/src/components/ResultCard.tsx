import type { Status, VerifyResponse } from '../types'

const EXPLORER = import.meta.env.VITE_EXPLORER_URL ?? 'https://amoy.polygonscan.com/tx/'

const LOOK: Record<Status, { icon: string; title: string; blurb: string; box: string }> = {
  verified: { icon: '✅', title: 'Verified', blurb: 'This record matches what the university anchored on-chain.', box: 'border-green-500 bg-green-50' },
  mismatch: { icon: '⚠️', title: 'Mismatch', blurb: 'A record exists, but these details do not match it.', box: 'border-amber-500 bg-amber-50' },
  not_found: { icon: '❓', title: 'Not found', blurb: 'No record with this serial number for this university.', box: 'border-slate-400 bg-slate-50' },
  revoked: { icon: '⛔', title: 'Revoked', blurb: 'The university has withdrawn this certificate.', box: 'border-red-500 bg-red-50' },
  unaccredited: { icon: '🚫', title: 'Unaccredited institution', blurb: 'This institution is not on the CUE-recognised list.', box: 'border-red-500 bg-red-50' },
}

export default function ResultCard({ r }: { r: VerifyResponse }) {
  const look = LOOK[r.status]
  return (
    <div className={`rounded-2xl border-2 p-4 ${look.box}`}>
      <div className="flex items-center gap-2 text-xl font-bold"><span>{look.icon}</span>{look.title}</div>
      <p className="mt-1 text-slate-700">{look.blurb}</p>

      {r.university && (
        <p className="mt-3 text-sm"><b>{r.university.name}</b>{' '}
          <span className={r.university.accredited ? 'text-green-700' : 'text-red-700'}>
            ({r.university.accredited ? 'accredited' : 'not accredited'})
          </span>
        </p>
      )}

      {r.mismatchedFields.length > 0 && (
        <p className="mt-2 text-sm">Differs in: {r.mismatchedFields.map((f) => (
          <span key={f} className="mr-1 rounded bg-amber-200 px-2 py-0.5 font-medium">{f.replace(/_/g, ' ')}</span>
        ))}</p>
      )}

      {r.txHash && (
        <p className="mt-2 break-all text-sm">
          Anchored {r.anchoredAt ? new Date(r.anchoredAt).toLocaleString() : ''} ·{' '}
          <a className="text-blue-700 underline" href={EXPLORER + r.txHash} target="_blank" rel="noreferrer">view on Polygon explorer</a>
        </p>
      )}

      {r.aiRisk && (
        <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm">
          <b>AI risk signal: {Math.round(r.aiRisk.score * 100)}%</b>
          <p className="mt-1">{r.aiRisk.notes}</p>
          <p className="mt-1 text-xs text-slate-500">A signal to prompt a closer look, not proof.</p>
        </div>
      )}
    </div>
  )
}
