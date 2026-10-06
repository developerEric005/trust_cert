/**
 * Hashing utility — follows the FROZEN spec in /docs/HASHING.md exactly.
 *
 * Field order: reg_no | student_name | award | class_of_award | graduation_year | serial_no | salt
 * Normalise: trim, collapse whitespace, lowercase, Unicode NFC.
 * Leaf = SHA-256 of UTF-8 string, 0x-prefixed 64-hex.
 * Salt = 16 random bytes, hex.
 */
import { createHash, randomBytes } from 'crypto';

/** Normalise a single field value per the frozen spec. */
export function normaliseField(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')   // collapse repeated whitespace to one space
    .toLowerCase()
    .normalize('NFC');
}

export interface LeafFields {
  reg_no: string;
  student_name: string;
  award: string;
  class_of_award: string;
  graduation_year: string | number;
  serial_no: string;
  salt: string;
}

/**
 * Build the pre-image string from fields in the frozen order.
 * Normalises every field (including salt — it's already hex but lowercase is fine).
 */
export function buildPreimage(fields: LeafFields): string {
  const parts = [
    normaliseField(String(fields.reg_no)),
    normaliseField(String(fields.student_name)),
    normaliseField(String(fields.award)),
    normaliseField(String(fields.class_of_award)),
    normaliseField(String(fields.graduation_year)),
    normaliseField(String(fields.serial_no)),
    normaliseField(String(fields.salt)),
  ];
  return parts.join('|');
}

/**
 * Compute the leaf hash.  Returns a 0x-prefixed 64-hex string (bytes32).
 */
export function computeLeaf(fields: LeafFields): string {
  const preimage = buildPreimage(fields);
  const hash = createHash('sha256').update(preimage, 'utf8').digest('hex');
  return '0x' + hash;
}

/**
 * Generate a random salt: 16 random bytes as lowercase hex (32 hex chars).
 */
export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/**
 * SHA-256 hash function for merkletreejs (Buffer in, Buffer out).
 * Used with hashLeaves: false because we pre-hash leaves ourselves.
 */
export function sha256ForMerkle(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}
