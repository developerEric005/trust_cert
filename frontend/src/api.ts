import { mockPhoto, mockUniversities, mockVerify } from './mocks'
import type { BatchResponse, CertFields, LoginResponse, PhotoResponse, University, VerifyResponse } from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''
const MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms))
const json = { 'Content-Type': 'application/json' }
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init)
  if (!res.ok) {
    let msg = `Request failed (${res.status}). Please try again.`
    try { const b = await res.json(); if (b.error) msg = b.error } catch { /* body is not JSON */ }
    throw new Error(msg)
  }
  return (await res.json().catch(() => undefined)) as T
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
  fd.append('image', file) // field name "image" is assumed by the API contract
  return http('/verify/photo', { method: 'POST', body: fd })
}

export async function verifyCheck(universityId: number, fields: CertFields): Promise<VerifyResponse> {
  if (MOCK) { await wait(); return mockVerify(fields.serial_no, fields) }
  return http('/verify/check', { method: 'POST', headers: json, body: JSON.stringify({ universityId, fields }) })
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  if (MOCK) {
    await wait(500)
    if (!email || !password) throw new Error('Wrong email or password.')
    const admin = email.toLowerCase().includes('admin')
    return { token: 'mock-token', role: admin ? 'admin' : 'registrar', universityId: admin ? null : 1 }
  }
  return http('/auth/login', { method: 'POST', headers: json, body: JSON.stringify({ email, password }) })
}

export async function uploadBatch(file: File, token: string): Promise<BatchResponse> {
  if (MOCK) {
    await wait(2200)
    return { batchId: 1, root: '0x' + '7c1e9a4f'.repeat(8), txHash: '0x' + 'ab'.repeat(32), count: 30 }
  }
  const fd = new FormData()
  fd.append('file', file)
  return http('/batches', { method: 'POST', headers: bearer(token), body: fd })
}

export async function revokeRecord(serial: string, reason: string, token: string): Promise<void> {
  if (MOCK) {
    await wait()
    if (!['MUST-001', 'MUST-002', 'MUST-003'].includes(serial.toUpperCase())) throw new Error('No record with that serial number.')
    return
  }
  await http(`/records/${encodeURIComponent(serial)}/revoke`, {
    method: 'POST', headers: { ...json, ...bearer(token) }, body: JSON.stringify({ reason }),
  })
}

export async function approveUniversity(id: number, token: string): Promise<void> {
  if (MOCK) {
    await wait(500)
    const u = mockUniversities.find((x) => x.id === id)
    if (u) u.accredited = true
    return
  }
  await http(`/admin/universities/${id}/approve`, { method: 'POST', headers: bearer(token) })
}
