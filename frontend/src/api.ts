import { mockPhoto, mockUniversities, mockVerify } from './mocks'
import type { CertFields, PhotoResponse, University, VerifyResponse } from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''
const MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms))

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init)
  if (!res.ok) throw new Error(`Server said ${res.status}. Please try again.`)
  return res.json()
}

export async function getUniversities(): Promise<University[]> {
  if (MOCK) { await wait(300); return mockUniversities }
  return http('/universities')
}

export async function verifyBySerial(uniId: number, serial: string): Promise<VerifyResponse> {
  if (MOCK) { await wait(); return mockVerify(serial) }
  return http(`/verify/${uniId}/${encodeURIComponent(serial.trim())}`)
}

export async function verifyPhoto(file: File): Promise<PhotoResponse> {
  if (MOCK) { await wait(1200); return mockPhoto }
  const fd = new FormData()
  fd.append('image', file) // assumption: multipart field name is "image"
  return http('/verify/photo', { method: 'POST', body: fd })
}

export async function verifyCheck(universityId: number, fields: CertFields): Promise<VerifyResponse> {
  if (MOCK) { await wait(); return mockVerify(fields.serial_no, fields) }
  return http('/verify/check', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ universityId, fields }),
  })
}
