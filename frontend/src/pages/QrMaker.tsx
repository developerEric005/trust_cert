import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import { getUniversities } from '../api'
import { inputClass, outlineButton, primaryButton } from '../ui'
import type { University } from '../types'

interface Code { serial: string; img: string }

export default function QrMaker() {
  const [unis, setUnis] = useState<University[]>([])
  const [uniId, setUniId] = useState(0)
  const [base, setBase] = useState(window.location.origin)
  const [text, setText] = useState('MUST-001\nMUST-002\nMUST-003')
  const [codes, setCodes] = useState<Code[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getUniversities()
      .then((u) => { setUnis(u); if (u[0]) setUniId(u[0].id) })
      .catch((e) => setError(e.message))
  }, [])

  const serials = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)

  const generate = async () => {
    const root = base.trim().replace(/\/+$/, '')
    setCodes(await Promise.all(serials.map(async (serial) => ({
      serial,
      img: await toDataURL(`${root}/verify/${uniId}/${encodeURIComponent(serial)}`, { width: 360, margin: 2, errorCorrectionLevel: 'M' }),
    }))))
  }

  const loadCsv = async (f?: File) => {
    if (!f) return
    const lines = (await f.text()).split(/\r?\n/).filter((l) => l.trim())
    const col = (lines[0] ?? '').split(',').map((h) => h.trim()).indexOf('serial_no')
    if (col < 0) { setError('This CSV has no serial_no column.'); return }
    setError('')
    setText(lines.slice(1).map((l) => l.split(',')[col]?.trim()).filter(Boolean).join('\n'))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 print:hidden">
        <h2 className="text-2xl font-bold text-navy-900">Certificate QR codes</h2>
        <p className="text-sm text-slate-600">Each code opens the verify page for one certificate. Print them onto the certificates.</p>
        <label className="block text-sm font-medium text-navy-900">Site address
          <input className={inputClass} value={base} onChange={(e) => setBase(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-navy-900">University
          <select className={inputClass} value={uniId} onChange={(e) => setUniId(Number(e.target.value))}>
            {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-navy-900">Serial numbers, one per line
          <textarea className={`${inputClass} h-32 font-mono`} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className={`${outlineButton} cursor-pointer`}>
          Load serial numbers from a CSV file
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => loadCsv(e.target.files?.[0])} />
        </label>
        {error && <p className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
        <div className="flex gap-3">
          <button className={primaryButton} disabled={!serials.length || !uniId} onClick={generate}>Make QR codes</button>
          {codes.length > 0 && <button className={outlineButton} onClick={() => window.print()}>Print</button>}
        </div>
      </div>

      {codes.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
          {codes.map((c) => (
            <figure key={c.serial} className="break-inside-avoid rounded-xl border border-slate-200 p-3 text-center">
              <img src={c.img} alt={`QR code for ${c.serial}`} className="mx-auto w-full max-w-[200px]" />
              <figcaption className="mt-2 font-mono text-sm font-semibold text-navy-900">{c.serial}</figcaption>
              <a download={`${c.serial}.png`} href={c.img} className="mt-1 block text-sm font-semibold text-teal-700 underline print:hidden">Download PNG</a>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
