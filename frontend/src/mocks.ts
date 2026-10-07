import type { CertFields, PhotoResponse, University, VerifyResponse } from './types'

const must: University = { id: 1, name: 'Meru University of Science and Technology', accredited: true }
const fake: University = { id: 99, name: 'Kenya Premier Global University', accredited: false }
export const mockUniversities: University[] = [
  must, { id: 2, name: 'University of Nairobi', accredited: true }, fake,
]

const base = { revoked: false, mismatchedFields: [], txHash: '0x' + 'ab'.repeat(32), anchoredAt: '2026-10-05T09:00:00Z' }

// Magic serials for testing every state in mock mode
const cases: Record<string, VerifyResponse> = {
  'MUST-001': { ...base, status: 'verified', university: must, aiRisk: { score: 0.05, notes: 'Fields are consistent and the layout looks normal. No signs of editing.' } },
  'MUST-002': { ...base, status: 'mismatch', university: must, mismatchedFields: ['class_of_award'], aiRisk: { score: 0.7, notes: 'The class of award differs from the registry. This is a common sign of an altered certificate.' } },
  'MUST-003': { ...base, status: 'revoked', revoked: true, university: must, aiRisk: { score: 0.4, notes: 'The record exists but the university has revoked it.' } },
  'FAKE-001': { ...base, status: 'unaccredited', university: fake, txHash: null, anchoredAt: null, aiRisk: { score: 0.9, notes: 'This institution is not on the CUE-recognised list.' } },
}
const notFound: VerifyResponse = { status: 'not_found', university: must, revoked: false, mismatchedFields: [], aiRisk: null }

export function mockVerify(serial: string, fields?: CertFields): VerifyResponse {
  const hit = cases[serial.trim().toUpperCase()] ?? notFound
  // Photo flow demo: editing the class of a genuine record turns it into a mismatch
  if (hit.status === 'verified' && fields && fields.class_of_award.trim().toLowerCase() !== 'first class honours') {
    return { ...cases['MUST-002'], aiRisk: cases['MUST-002'].aiRisk }
  }
  return hit
}

export const mockPhoto: PhotoResponse = {
  confidence: 0.92,
  fields: {
    reg_no: 'CS/2022/001', student_name: 'Amina Wanjiru Otieno', award: 'Bachelor of Science in Computer Science',
    class_of_award: 'First Class Honours', graduation_year: 2026, serial_no: 'MUST-001',
    university_name: 'Meru University of Science and Technology',
  },
}
