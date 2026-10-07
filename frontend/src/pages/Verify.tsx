import { useEffect, useState } from 'react'
import { getUniversities, verifyBySerial, verifyCheck, verifyPhoto } from '../api'
import ResultCard from '../components/ResultCard'
import { Link } from '../router'
import { inputClass, outlineButton, primaryButton } from '../ui'
import type { CertFields, University, VerifyResponse } from '../types'

const EDITABLE: [keyof CertFields, string][] = [
  ['student_name', 'Student name'], ['reg_no', 'Reg. no'], ['award', 'Award'],
  ['class_of_award', 'Class of award'], ['graduation_year', 'Graduation year'], ['serial_no', 'Serial no'],
]

export default function Verify({ initial }: { initial?: { uniId: number; serial: string } }) {
  const [tab, setTab] = useState<'serial' | 'photo'>('serial')
  const [unis, setUnis] = useState<University[]>([])
  const [uniId, setUniId] = useState(initial?.uniId ?? 0)
  const [serial, setSerial] = useState(initial?.serial ?? '')
  const [fields, setFields] = useState<CertFields | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async <T,>(fn: () => Promise<T>, ok: (v: T) => void) => {
    setLoading(true); setError(''); setResult(null)
    try { ok(await fn()) } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  useEffect(() => {
    getUniversities()
      .then((u) => { setUnis(u); if (!initial && u[0]) setUniId(u[0].id) })
      .catch((e) => setError(e.message))
    if (initial) run(() => verifyBySerial(initial.uniId, initial.serial), setResult)
  }, [])

  const uniSelect = (
    <select className={inputClass} value={uniId} onChange={(e) => setUniId(Number(e.target.value))}>
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
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-100 p-1 text-center text-sm font-medium">
        {(['serial', 'photo'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setResult(null); setError('') }}
            className={`rounded-lg py-2.5 ${tab === t ? 'bg-white font-semibold text-navy-900 shadow' : 'text-navy-700'}`}>
            {t === 'serial' ? 'Serial number' : 'Photo of certificate'}
          </button>
        ))}
      </div>

      {tab === 'serial' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-navy-900">University{uniSelect}</label>
          <label className="block text-sm font-medium text-navy-900">Serial number
            <input className={inputClass} value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. MUST-001" />
          </label>
          <button className={primaryButton} disabled={loading || !serial.trim() || !uniId}
            onClick={() => run(() => verifyBySerial(uniId, serial), setResult)}>
            {loading ? 'Checking...' : 'Verify'}
          </button>
          <Link to="/scan" className={outlineButton}>Scan QR code</Link>
        </div>
      )}

      {tab === 'photo' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-navy-900">Take or upload a photo
            <input type="file" accept="image/*" capture="environment" className={inputClass}
              onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          {loading && !fields && <p className="text-slate-600">Reading the certificate...</p>}

          {fields && (
            <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
              <p className="text-sm text-slate-600">
                Check what we read and fix anything wrong.{confidence !== null && ` Read confidence: ${Math.round(confidence * 100)}%.`}
              </p>
              <label className="block text-sm font-medium text-navy-900">University{uniSelect}</label>
              {EDITABLE.map(([k, label]) => (
                <label key={k} className="block text-sm font-medium text-navy-900">{label}
                  <input className={inputClass} value={String(fields[k] ?? '')}
                    onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
                </label>
              ))}
              <button className={primaryButton} disabled={loading} onClick={check}>{loading ? 'Checking...' : 'Check certificate'}</button>
            </div>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
      {result && <ResultCard r={result} />}
    </div>
  )
}
