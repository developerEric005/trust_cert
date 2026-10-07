// Mirrors section 8 of the shared prompt. Do not change without telling the team.
export type Status = 'verified' | 'mismatch' | 'not_found' | 'revoked' | 'unaccredited'

export interface University { id: number; name: string; accredited: boolean }

export interface VerifyResponse {
  status: Status
  university?: University | null
  revoked: boolean
  mismatchedFields: string[]
  txHash?: string | null
  anchoredAt?: string | null
  aiRisk?: { score: number; notes: string } | null
}

export interface CertFields {
  reg_no: string
  student_name: string
  award: string
  class_of_award: string
  graduation_year: string | number
  serial_no: string
  university_name: string
}

export interface PhotoResponse { fields: CertFields; confidence: number }
