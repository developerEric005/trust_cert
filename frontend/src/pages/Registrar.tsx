import { useEffect, useState, type DragEvent } from 'react'
import { getUniversities, revokeRecord, uploadBatch } from '../api'
import { getSession } from '../auth'
import DashboardLayout from '../components/DashboardLayout'
import { navigate } from '../router'
import { dangerButton, inputClass, primaryButton } from '../ui'
import type { BatchResponse } from '../types'

const COLUMNS = ['reg_no', 'student_name', 'programme', 'award', 'class_of_award', 'graduation_year', 'serial_no']
const EXPLORER = import.meta.env.VITE_EXPLORER_URL ?? 'https://amoy.polygonscan.com/tx/'

type Preview = { rows: number } | { error: string }

async function inspect(file: File): Promise<Preview> {
  const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim())
  const header = (lines[0] ?? '').split(',').map((h) => h.trim())
  const missing = COLUMNS.filter((c) => !header.includes(c))
  return missing.length ? { error: `Missing columns: ${missing.join(', ')}` } : { rows: lines.length - 1 }
}

const short = (h: string) => `${h.slice(0, 8)}...${h.slice(-4)}`

function Row({ k, v, title, mono }: { k: string; v: string; title?: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-slate-600">{k}</span>
      <span title={title} className={`font-semibold text-navy-900 ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  )
}

export default function Registrar() {
  const session = getSession()
  const allowed = session?.role === 'registrar'
  const [orgName, setOrgName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [uploading, setUploading] = useState(false)
  const [batch, setBatch] = useState<BatchResponse | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [serial, setSerial] = useState('')
  const [reason, setReason] = useState('')
  const [revoking, setRevoking] = useState(false)
  const [revokeMsg, setRevokeMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!allowed) { navigate('/login'); return }
    getUniversities()
      .then((u) => setOrgName(u.find((x) => x.id === session?.universityId)?.name ?? ''))
      .catch(() => {})
          // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!session || !allowed) return null

  const choose = async (f?: File) => {
    if (!f) return
    setFile(f); setBatch(null); setUploadError('')
    setPreview(await inspect(f))
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); choose(e.dataTransfer.files[0]) }

  const upload = async () => {
    if (!file) return
    setUploading(true); setUploadError('')
    try { setBatch(await uploadBatch(file, session.token)) }
    catch (e) { setUploadError((e as Error).message) }
    finally { setUploading(false) }
  }

  const revoke = async () => {
    const s = serial.trim()
    if (!window.confirm(`Revoke ${s}? The revocation is recorded on-chain.`)) return
    setRevoking(true); setRevokeMsg(null)
    try {
      await revokeRecord(s, reason.trim(), session.token)
      setRevokeMsg({ ok: true, text: `${s} has been revoked.` })
      setSerial(''); setReason('')
    } catch (e) {
      setRevokeMsg({ ok: false, text: (e as Error).message })
    } finally {
      setRevoking(false)
    }
  }

  const blocked = !file || uploading || !preview || 'error' in preview

  return (
    <DashboardLayout title="Upload batch" orgName={orgName} nav={[['Upload batch', '#upload'], ['Revoke record', '#revoke'], ['Certificate QR codes', '/qr'], ['Public verify page', '/']]}>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
        <section id="upload" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-navy-900">Upload a graduate batch</h2>
          <p className="text-sm text-slate-600">CSV columns: {COLUMNS.join(', ')}</p>
          <label onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-teal-500 bg-navy-50 px-4 py-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#067A73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V5M7 9l5-5 5 5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
            </svg>
            <span className="font-semibold text-navy-900">{file ? file.name : 'Choose or drop a CSV file'}</span>
            {preview && ('error' in preview
              ? <span className="text-sm text-red-700">{preview.error}</span>
              : <span className="text-sm text-green-700">{preview.rows} rows ready, all columns found</span>)}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
          </label>
          {uploading && (
            <div>
              <p className="text-sm text-slate-600">Anchoring on Polygon...</p>
              <div className="mt-1 h-2 overflow-hidden rounded bg-navy-100"><div className="h-full w-1/2 animate-pulse rounded bg-teal-500" /></div>
            </div>
          )}
          {uploadError && <p className="rounded-lg bg-red-100 p-3 text-red-800">{uploadError}</p>}
          <button className={`${primaryButton} sm:w-60`} disabled={blocked} onClick={upload}>Upload and anchor</button>
        </section>

        <div className="space-y-6">
          {batch && (
            <section className="space-y-2 rounded-2xl border-2 border-green-500 bg-green-50 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-green-700">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <circle cx="14" cy="14" r="14" fill="#22C55E" />
                  <path d="M8 14.5l4 4 8-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Batch anchored
              </h2>
              <Row k="Batch ID" v={String(batch.batchId)} />
              <Row k="Records" v={String(batch.count)} />
              <Row k="Merkle root" v={short(batch.root)} title={batch.root} mono />
              <a className="block text-sm font-semibold text-teal-700 underline" href={EXPLORER + batch.txHash} target="_blank" rel="noreferrer">
                View transaction on Polygon explorer
              </a>
            </section>
          )}

          <section id="revoke" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-navy-900">Revoke a record</h2>
            <label className="block text-sm font-medium text-navy-900">Serial number
              <input className={inputClass} value={serial} onChange={(e) => setSerial(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-navy-900">Reason
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {revokeMsg && (
              <p className={`rounded-lg p-3 ${revokeMsg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{revokeMsg.text}</p>
            )}
            <button className={dangerButton} disabled={revoking || !serial.trim() || !reason.trim()} onClick={revoke}>
              {revoking ? 'Revoking...' : 'Revoke certificate'}
            </button>
            <p className="text-xs text-slate-500">The revocation is recorded on-chain and checked on every verification.</p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
