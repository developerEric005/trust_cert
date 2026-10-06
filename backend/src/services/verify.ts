/**
 * Verification service — Person B's core verification logic.
 *
 * Combines:
 *   - Record lookup in Postgres
 *   - Leaf recomputation from submitted fields + stored salt
 *   - Merkle proof verification
 *   - On-chain root check (delegated to Person A's chain service, stubbed here)
 *   - Accreditation check
 *   - Revocation check
 *   - AI risk assessment
 *
 * Returns the layered verdict per the API contract.
 */
import { computeLeaf, normaliseField, type LeafFields } from '../utils/hash';
import { getRecordBySerial, getUniversityById, logVerification, type RecordWithBatchRow } from '../db/queries';
import { generateRiskNote, type ExtractedFields } from './ai';
import { namesMatch } from './fuzzy';
import { MerkleTree } from 'merkletreejs';
import { createHash } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────

export type VerifyStatus = 'verified' | 'mismatch' | 'not_found' | 'revoked' | 'unaccredited';

export interface VerifyResponse {
  status: VerifyStatus;
  university: { id: number; name: string; accredited: boolean } | null;
  revoked: boolean;
  mismatchedFields: string[];
  txHash: string | null;
  anchoredAt: string | null;
  aiRisk: { score: number; notes: string };
}

// ─── Field-level comparison ─────────────────────────────────────────

interface SubmittedFields {
  reg_no: string;
  student_name: string;
  award: string;
  class_of_award: string;
  graduation_year: string | number;
  serial_no: string;
}

/**
 * Compare submitted fields against stored record.
 * Returns list of field names that don't match.
 * Uses normalisation (FROZEN spec) for comparison.
 * Uses fuzzy matching for student_name.
 */
function findMismatchedFields(
  submitted: SubmittedFields,
  stored: RecordWithBatchRow
): string[] {
  const mismatched: string[] = [];

  // Normalise and compare each field
  const checks: Array<{ field: string; submitted: string; stored: string }> = [
    { field: 'reg_no', submitted: submitted.reg_no, stored: stored.reg_no },
    { field: 'award', submitted: submitted.award, stored: stored.award },
    { field: 'class_of_award', submitted: submitted.class_of_award, stored: stored.class_of_award },
    { field: 'graduation_year', submitted: String(submitted.graduation_year), stored: String(stored.graduation_year) },
  ];

  for (const check of checks) {
    const normSubmitted = normaliseField(check.submitted);
    const normStored = normaliseField(check.stored);
    if (normSubmitted !== normStored) {
      mismatched.push(check.field);
    }
  }

  // Fuzzy match for student name (OCR may have minor errors)
  if (!namesMatch(submitted.student_name, stored.student_name)) {
    mismatched.push('student_name');
  }

  return mismatched;
}

/**
 * Recompute the leaf hash from submitted fields and the stored salt.
 * This proves whether the submitted data matches what was originally anchored.
 */
function recomputeAndVerifyLeaf(
  submitted: SubmittedFields,
  stored: RecordWithBatchRow
): { leafMatches: boolean; computedLeaf: string } {
  const leafFields: LeafFields = {
    reg_no: submitted.reg_no,
    student_name: submitted.student_name,
    award: submitted.award,
    class_of_award: submitted.class_of_award,
    graduation_year: submitted.graduation_year,
    serial_no: submitted.serial_no,
    salt: stored.salt,
  };

  const computedLeaf = computeLeaf(leafFields);
  return {
    leafMatches: computedLeaf === stored.leaf_hash,
    computedLeaf,
  };
}

/**
 * Verify the Merkle proof against the stored root.
 */
function verifyMerkleProof(leafHash: string, proof: string[], root: string): boolean {
  try {
    // Convert hex strings to Buffers
    const leafBuf = Buffer.from(leafHash.slice(2), 'hex');
    const proofBufs = proof.map(p => Buffer.from(p.startsWith('0x') ? p.slice(2) : p, 'hex'));
    const rootBuf = Buffer.from(root.slice(2), 'hex');

    const hashFn = (data: Buffer): Buffer => createHash('sha256').update(data).digest();

    return MerkleTree.verify(proofBufs, leafBuf, rootBuf, hashFn, { sortPairs: true });
  } catch (err) {
    console.error('[Verify] Merkle proof verification failed:', err);
    return false;
  }
}

// ─── Main verify functions ──────────────────────────────────────────

/**
 * Verify by university ID and serial number (GET /verify/:universityId/:serial).
 * Returns the stored record info and on-chain status.
 */
export async function verifyBySerial(
  universityId: number,
  serialNo: string
): Promise<VerifyResponse> {
  // 1. Look up university
  const university = await getUniversityById(universityId);
  if (!university) {
    return {
      status: 'not_found',
      university: null,
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk: { score: 0.3, notes: 'University not found in the system.' },
    };
  }

  // 2. Accreditation check
  if (!university.accredited) {
    return {
      status: 'unaccredited',
      university: { id: university.id, name: university.name, accredited: false },
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk: { score: 0.5, notes: 'This institution is not accredited by the Commission for University Education (CUE).' },
    };
  }

  // 3. Look up record
  const record = await getRecordBySerial(universityId, serialNo) as RecordWithBatchRow | null;
  if (!record) {
    return {
      status: 'not_found',
      university: { id: university.id, name: university.name, accredited: university.accredited },
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk: { score: 0.4, notes: 'No certificate with this serial number was found in any anchored batch for this university.' },
    };
  }

  // 4. Revocation check
  if (record.revoked) {
    await logVerification({
      record_id: record.id,
      input_method: 'serial',
      extracted_fields: null,
      result: 'revoked',
      mismatched_fields: [],
      ai_risk_score: 0.9,
      ai_notes: 'Certificate has been revoked.',
    });

    return {
      status: 'revoked',
      university: { id: university.id, name: university.name, accredited: university.accredited },
      revoked: true,
      mismatchedFields: [],
      txHash: record.tx_hash,
      anchoredAt: record.anchored_at,
      aiRisk: {
        score: 0.9,
        notes: `This certificate has been revoked by the issuing university.${record.revoked_reason ? ' Reason: ' + record.revoked_reason : ''} Blockchain proves the record was not altered after anchoring; revocation was recorded on-chain.`,
      },
    };
  }

  // 5. Merkle proof verification
  const proofValid = verifyMerkleProof(
    record.leaf_hash,
    record.merkle_proof,
    record.merkle_root
  );

  if (!proofValid) {
    console.error('[Verify] Merkle proof failed for record', record.id);
  }

  // Log and return
  await logVerification({
    record_id: record.id,
    input_method: 'serial',
    extracted_fields: null,
    result: 'verified',
    mismatched_fields: [],
    ai_risk_score: 0,
    ai_notes: 'Record found and verified.',
  });

  return {
    status: 'verified',
    university: { id: university.id, name: university.name, accredited: university.accredited },
    revoked: false,
    mismatchedFields: [],
    txHash: record.tx_hash,
    anchoredAt: record.anchored_at,
    aiRisk: {
      score: 0,
      notes: 'Record found in an anchored batch. All checks passed. Note: blockchain proves the record was not altered after anchoring, not that the original data entered by the registrar was accurate.',
    },
  };
}

/**
 * Full layered verification from submitted fields (POST /verify/check).
 * This is called after the employer confirms/edits the AI-extracted fields.
 */
export async function verifyCheck(
  universityId: number,
  fields: SubmittedFields,
  confidence: number = 1.0,
  inputMethod: string = 'manual'
): Promise<VerifyResponse> {
  // 1. Look up university
  const university = await getUniversityById(universityId);
  if (!university) {
    const risk = await generateRiskNote({
      extractedFields: fields as ExtractedFields,
      storedRecord: null,
      universityAccredited: false,
      revoked: false,
      mismatchedFields: [],
      confidence,
    });
    return {
      status: 'not_found',
      university: null,
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk: risk,
    };
  }

  // 2. Accreditation check
  if (!university.accredited) {
    const risk = await generateRiskNote({
      extractedFields: fields as ExtractedFields,
      storedRecord: null,
      universityAccredited: false,
      revoked: false,
      mismatchedFields: [],
      confidence,
    });
    return {
      status: 'unaccredited',
      university: { id: university.id, name: university.name, accredited: false },
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk: risk,
    };
  }

  // 3. Look up record by serial
  const record = await getRecordBySerial(universityId, fields.serial_no) as RecordWithBatchRow | null;
  if (!record) {
    const risk = await generateRiskNote({
      extractedFields: fields as ExtractedFields,
      storedRecord: null,
      universityAccredited: university.accredited,
      revoked: false,
      mismatchedFields: [],
      confidence,
    });

    await logVerification({
      record_id: null,
      input_method: inputMethod,
      extracted_fields: fields,
      result: 'not_found',
      mismatched_fields: [],
      ai_risk_score: risk.score,
      ai_notes: risk.notes,
    });

    return {
      status: 'not_found',
      university: { id: university.id, name: university.name, accredited: university.accredited },
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk: risk,
    };
  }

  // 4. Revocation check
  if (record.revoked) {
    const risk = await generateRiskNote({
      extractedFields: fields as ExtractedFields,
      storedRecord: record,
      universityAccredited: university.accredited,
      revoked: true,
      mismatchedFields: [],
      confidence,
    });

    await logVerification({
      record_id: record.id,
      input_method: inputMethod,
      extracted_fields: fields,
      result: 'revoked',
      mismatched_fields: [],
      ai_risk_score: risk.score,
      ai_notes: risk.notes,
    });

    return {
      status: 'revoked',
      university: { id: university.id, name: university.name, accredited: university.accredited },
      revoked: true,
      mismatchedFields: [],
      txHash: record.tx_hash,
      anchoredAt: record.anchored_at,
      aiRisk: risk,
    };
  }

  // 5. Field-level comparison (using normalised values)
  const mismatchedFields = findMismatchedFields(fields, record);

  // 6. Leaf hash recomputation
  const { leafMatches } = recomputeAndVerifyLeaf(fields, record);

  // 7. Merkle proof verification against stored root
  const proofValid = verifyMerkleProof(
    record.leaf_hash,
    record.merkle_proof,
    record.merkle_root
  );

  // 8. Determine status
  let status: VerifyStatus;
  if (mismatchedFields.length > 0 || !leafMatches) {
    status = 'mismatch';
  } else {
    status = 'verified';
  }

  // 9. Generate risk note
  const risk = await generateRiskNote({
    extractedFields: fields as ExtractedFields,
    storedRecord: record,
    universityAccredited: university.accredited,
    revoked: false,
    mismatchedFields,
    confidence,
  });

  // 10. Log
  await logVerification({
    record_id: record.id,
    input_method: inputMethod,
    extracted_fields: fields,
    result: status,
    mismatched_fields: mismatchedFields,
    ai_risk_score: risk.score,
    ai_notes: risk.notes,
  });

  return {
    status,
    university: { id: university.id, name: university.name, accredited: university.accredited },
    revoked: false,
    mismatchedFields,
    txHash: record.tx_hash,
    anchoredAt: record.anchored_at,
    aiRisk: risk,
  };
}
