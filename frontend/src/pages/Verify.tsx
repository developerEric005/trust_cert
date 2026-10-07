import { useEffect, useState } from 'react'
import { getUniversities, verifyBySerial, verifyCheck, verifyPhoto } from '../api'
import ResultCard from '../components/ResultCard'
import type { CertFields, University, VerifyResponse } from '../types'

const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base'
const btn = 'w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50'
const EDITABLE: [keyof CertFields, string][] = [
  ['student_name', 'Student name'], ['reg_no', 'Reg. no'], ['award', 'Award'],
  ['class_of_award', 'Class of award'], ['graduation_year', 'Graduation year'], ['serial_no', 'Serial no'],
]

export default function Verify() {
  const [tab, setTab] = useState<'serial' | 'photo'>('serial')
  const [unis, setUnis] = useState<University[]>([])
  const [uniId, setUniId] = useState(0)
  const [serial, setSerial] = useState('')
  const [fields, setFields] = useState<CertFields | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getUniversities().then((u) => { setUnis(u); if (u[0]) setUniId(u[0].id) }).catch((e) => setError(e.message))
  }, [])

  async function run<T>(fn: () => Promise<T>, ok: (v: T) => void) {
    setLoading(true); setError(''); setResult(null)
    try { ok(await fn()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  const uniSelect = (
    <select className={inp} value={uniId} onChange={(e) => setUniId(Number(e.target.value))}>
      {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  )

  const onPhoto = (f?: File) => {
    if (!f) return
    setFields(null)
    run(() => verifyPhoto(f), (r) => {
      setFields(r.fields); setConfidence(r.confidence)
      const m = unis.find((u) => u.name.toLowerCase() === r.fields.university_name?.trim().toLowerCase())
      if (m) setUniId(m.id)
    })
  }

  const check = () => {
    if (!fields) return
    const name = unis.find((u) => u.id === uniId)?.name ?? fields.university_name
    run(() => verifyCheck(uniId, { ...fields, university_name: name }), setResult)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-lg bg-navy-100 p-1 text-center font-medium">
        {(['serial', 'photo'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setResult(null); setError('') }}
            className={`rounded-md py-2 ${tab === t ? 'bg-white shadow' : ''}`}>
            {t === 'serial' ? 'Serial number' : 'Photo of certificate'}
          </button>
        ))}
      </div>

      {tab === 'serial' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">University{uniSelect}</label>
          <label className="block text-sm font-medium">Serial number
            <input className={inp} value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. MUST-001" />
          </label>
          <button className={btn} disabled={loading || !serial.trim() || !uniId}
            onClick={() => run(() => verifyBySerial(uniId, serial), setResult)}>
            {loading ? 'Checking…' : 'Verify'}
          </button>
        </div>
      )}

      {tab === 'photo' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium">Take or upload a photo
            <input type="file" accept="image/*" capture="environment" className={inp}
              onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          {loading && !fields && <p className="text-slate-600">Reading the certificate…</p>}

          {fields && (
            <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
              <p className="text-sm text-slate-600">
                Check what we read and fix anything wrong{confidence !== null && ` (read confidence ${Math.round(confidence * 100)}%)`}.
              </p>
              <label className="block text-sm font-medium">University{uniSelect}</label>
              {EDITABLE.map(([k, label]) => (
                <label key={k} className="block text-sm font-medium">{label}
                  <input className={inp} value={String(fields[k] ?? '')}
                    onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
                </label>
              ))}
              <button className={btn} disabled={loading} onClick={check}>{loading ? 'Checking…' : 'Check certificate'}</button>
            </div>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
      {result && <ResultCard r={result} />}
    </div>
  )
}
