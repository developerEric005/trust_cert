/**
 * Database queries used by Person B's routes (verify, AI).
 * Person A will add batch/auth queries in their own files.
 */
import pool from './pool';

// ─── University queries ─────────────────────────────────────────────

export interface UniversityRow {
  id: number;
  name: string;
  accredited: boolean;
  cue_charter_ref: string | null;
  wallet_address: string | null;
  status: string;
}

export async function getUniversityById(id: number): Promise<UniversityRow | null> {
  const { rows } = await pool.query(
    'SELECT id, name, accredited, cue_charter_ref, wallet_address, status FROM universities WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function getUniversityByName(name: string): Promise<UniversityRow | null> {
  // Case-insensitive search for AI extraction matching
  const { rows } = await pool.query(
    'SELECT id, name, accredited, cue_charter_ref, wallet_address, status FROM universities WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  return rows[0] || null;
}

export async function listUniversities(): Promise<UniversityRow[]> {
  const { rows } = await pool.query(
    'SELECT id, name, accredited FROM universities ORDER BY name'
  );
  return rows;
}

// ─── Record queries ─────────────────────────────────────────────────

export interface RecordRow {
  id: number;
  batch_id: number;
  university_id: number;
  serial_no: string;
  reg_no: string;
  student_name: string;
  programme: string | null;
  award: string;
  class_of_award: string;
  graduation_year: number;
  salt: string;
  leaf_hash: string;
  merkle_proof: string[];
  revoked: boolean;
  revoked_reason: string | null;
  revoked_tx: string | null;
}

export async function getRecordBySerial(universityId: number, serialNo: string): Promise<RecordRow | null> {
  const { rows } = await pool.query(
    `SELECT r.*, b.merkle_root, b.tx_hash, b.anchored_at
     FROM records r
     JOIN batches b ON r.batch_id = b.id
     WHERE r.university_id = $1 AND LOWER(r.serial_no) = LOWER($2)`,
    [universityId, serialNo]
  );
  return rows[0] || null;
}

// Extended row type that includes batch info
export interface RecordWithBatchRow extends RecordRow {
  merkle_root: string;
  tx_hash: string | null;
  anchored_at: string;
}

// ─── Batch queries ──────────────────────────────────────────────────

export interface BatchRow {
  id: number;
  university_id: number;
  merkle_root: string;
  tx_hash: string | null;
  block_number: number | null;
  record_count: number;
  anchored_at: string;
}

export async function getBatchById(id: number): Promise<BatchRow | null> {
  const { rows } = await pool.query('SELECT * FROM batches WHERE id = $1', [id]);
  return rows[0] || null;
}

// ─── Verification logging ───────────────────────────────────────────

export async function logVerification(params: {
  record_id: number | null;
  input_method: string;
  extracted_fields: object | null;
  result: string;
  mismatched_fields: string[];
  ai_risk_score: number | null;
  ai_notes: string | null;
}): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO verifications (record_id, input_method, extracted_fields, result, mismatched_fields, ai_risk_score, ai_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      params.record_id,
      params.input_method,
      params.extracted_fields ? JSON.stringify(params.extracted_fields) : null,
      params.result,
      params.mismatched_fields,
      params.ai_risk_score,
      params.ai_notes,
    ]
  );
  return rows[0].id;
}
