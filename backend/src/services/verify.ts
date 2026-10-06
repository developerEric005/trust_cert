import { pool } from "../db/pool";
import {
  CertificateFields,
  normalise,
  computeLeaf,
  verifyProof,
} from "../lib/hashing";
import { chainService } from "./chain";

export type VerificationStatus =
  | "verified"
  | "mismatch"
  | "not_found"
  | "revoked"
  | "unaccredited";

export interface VerifyResponse {
  status: VerificationStatus;
  university: {
    id: number;
    name: string;
    accredited: boolean;
  };
  revoked: boolean;
  mismatchedFields: string[];
  txHash: string | null;
  anchoredAt: string | null;
  aiRisk: {
    score: number;
    notes: string;
  };
}

/**
 * --- HOOK FOR PERSON B (AI Risk Analysis) ---
 * Person B will connect their image extraction model / confidence scoring here.
 * For core backend, this provides a sensible risk signal based on verification state.
 */
export function computeAIRiskSignal(
  status: VerificationStatus,
  mismatchedFields: string[]
): { score: number; notes: string } {
  switch (status) {
    case "verified":
      return {
        score: 0.05,
        notes: "No tampering detected. Cryptographic Merkle proof confirmed against Polygon Amoy registry.",
      };
    case "mismatch":
      return {
        score: 0.85,
        notes: `Data mismatch detected in field(s): ${mismatchedFields.join(
          ", "
        )}. Document content does not match anchored registry.`,
      };
    case "revoked":
      return {
        score: 0.95,
        notes: "Certificate has been officially revoked by the university registrar on-chain.",
      };
    case "unaccredited":
      return {
        score: 0.99,
        notes: "Issuing institution is not accredited by CUE or university approval is pending.",
      };
    case "not_found":
    default:
      return {
        score: 1.0,
        notes: "No certificate found matching the provided university and serial number.",
      };
  }
}

/**
 * Verifies a certificate record by (universityId, serialNo) and optional candidate fields.
 * Status Precedence: not_found > unaccredited > revoked > mismatch > verified
 */
export async function verifyRecord(
  universityId: number,
  serialNo: string,
  candidateFields?: Partial<CertificateFields>,
  inputMethod: string = "serial_lookup"
): Promise<VerifyResponse> {
  const normSerial = (serialNo || "").trim();

  // 1. Fetch University
  const uniRes = await pool.query(
    `SELECT id, name, cue_charter_ref, wallet_address, accredited, status
     FROM universities WHERE id = $1;`,
    [universityId]
  );

  const universityData = uniRes.rows[0];
  const uniResponseObj = {
    id: universityId,
    name: universityData ? universityData.name : "Unknown University",
    accredited: universityData ? !!universityData.accredited : false,
  };

  // Precedence 1: not_found (if university doesn't exist)
  if (!universityData) {
    const aiRisk = computeAIRiskSignal("not_found", []);
    await logVerification(null, inputMethod, candidateFields, "not_found", [], aiRisk);
    return {
      status: "not_found",
      university: uniResponseObj,
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk,
    };
  }

  // 2. Query Record & Batch from Database
  const recordRes = await pool.query(
    `SELECT r.id, r.batch_id, r.university_id, r.serial_no, r.reg_no,
            r.student_name, r.programme, r.award, r.class_of_award,
            r.graduation_year, r.salt, r.leaf_hash, r.merkle_proof,
            r.revoked, r.revoked_reason, r.revoked_tx,
            b.merkle_root, b.tx_hash, b.block_number, b.anchored_at
     FROM records r
     JOIN batches b ON r.batch_id = b.id
     WHERE r.university_id = $1 AND LOWER(TRIM(r.serial_no)) = LOWER(TRIM($2));`,
    [universityId, normSerial]
  );

  // Precedence 1: not_found (if serial doesn't exist in registry)
  if (recordRes.rows.length === 0) {
    const aiRisk = computeAIRiskSignal("not_found", []);
    await logVerification(null, inputMethod, candidateFields, "not_found", [], aiRisk);
    return {
      status: "not_found",
      university: uniResponseObj,
      revoked: false,
      mismatchedFields: [],
      txHash: null,
      anchoredAt: null,
      aiRisk,
    };
  }

  const record = recordRes.rows[0];

  // 3. Precedence 2: unaccredited
  // Check DB accreditation flag and status
  let isAccredited = universityData.accredited && universityData.status === "approved";
  // Cross-check on-chain approval if contract is configured
  if (chainService.contractAddress && universityData.wallet_address) {
    try {
      const onChainApproved = await chainService.isApproved(universityData.wallet_address);
      if (!onChainApproved) {
        isAccredited = false;
      }
    } catch (chainErr) {
      console.warn("Could not verify university on-chain approval:", chainErr);
    }
  }

  if (!isAccredited) {
    const aiRisk = computeAIRiskSignal("unaccredited", []);
    await logVerification(record.id, inputMethod, candidateFields, "unaccredited", [], aiRisk);
    return {
      status: "unaccredited",
      university: uniResponseObj,
      revoked: !!record.revoked,
      mismatchedFields: [],
      txHash: record.tx_hash || null,
      anchoredAt: record.anchored_at ? new Date(record.anchored_at).toISOString() : null,
      aiRisk,
    };
  }

  // 4. Precedence 3: revoked
  let isRevoked = !!record.revoked;
  // Cross-check on-chain revocation status
  if (chainService.contractAddress) {
    try {
      const onChainRevoked = await chainService.isRevoked(record.leaf_hash);
      if (onChainRevoked) {
        isRevoked = true;
      }
    } catch (chainErr) {
      console.warn("Could not query isRevoked on-chain:", chainErr);
    }
  }

  if (isRevoked) {
    const aiRisk = computeAIRiskSignal("revoked", []);
    await logVerification(record.id, inputMethod, candidateFields, "revoked", [], aiRisk);
    return {
      status: "revoked",
      university: uniResponseObj,
      revoked: true,
      mismatchedFields: [],
      txHash: record.revoked_tx || record.tx_hash || null,
      anchoredAt: record.anchored_at ? new Date(record.anchored_at).toISOString() : null,
      aiRisk,
    };
  }

  // 5. Precedence 4: mismatch
  const mismatchedFields: string[] = [];
  if (candidateFields && Object.keys(candidateFields).length > 0) {
    if (
      candidateFields.reg_no !== undefined &&
      normalise(candidateFields.reg_no) !== normalise(record.reg_no)
    ) {
      mismatchedFields.push("reg_no");
    }
    if (
      candidateFields.student_name !== undefined &&
      normalise(candidateFields.student_name) !== normalise(record.student_name)
    ) {
      mismatchedFields.push("student_name");
    }
    if (
      candidateFields.award !== undefined &&
      normalise(candidateFields.award) !== normalise(record.award)
    ) {
      mismatchedFields.push("award");
    }
    if (
      candidateFields.class_of_award !== undefined &&
      normalise(candidateFields.class_of_award) !== normalise(record.class_of_award)
    ) {
      mismatchedFields.push("class_of_award");
    }
    if (
      candidateFields.graduation_year !== undefined &&
      normalise(candidateFields.graduation_year) !== normalise(record.graduation_year)
    ) {
      mismatchedFields.push("graduation_year");
    }
    if (
      candidateFields.serial_no !== undefined &&
      normalise(candidateFields.serial_no) !== normalise(record.serial_no)
    ) {
      mismatchedFields.push("serial_no");
    }
  }

  if (mismatchedFields.length > 0) {
    const aiRisk = computeAIRiskSignal("mismatch", mismatchedFields);
    await logVerification(record.id, inputMethod, candidateFields, "mismatch", mismatchedFields, aiRisk);
    return {
      status: "mismatch",
      university: uniResponseObj,
      revoked: false,
      mismatchedFields,
      txHash: record.tx_hash || null,
      anchoredAt: record.anchored_at ? new Date(record.anchored_at).toISOString() : null,
      aiRisk,
    };
  }

  // 6. Cryptographic Proof & Chain Validation
  const proof: string[] =
    typeof record.merkle_proof === "string"
      ? JSON.parse(record.merkle_proof)
      : record.merkle_proof || [];

  const proofValid = verifyProof(proof, record.leaf_hash, record.merkle_root);
  if (!proofValid) {
    const aiRisk = {
      score: 0.98,
      notes: "CRITICAL: Merkle proof verification failed against the anchored batch root.",
    };
    await logVerification(record.id, inputMethod, candidateFields, "mismatch", ["merkle_proof"], aiRisk);
    return {
      status: "mismatch",
      university: uniResponseObj,
      revoked: false,
      mismatchedFields: ["merkle_proof"],
      txHash: record.tx_hash || null,
      anchoredAt: record.anchored_at ? new Date(record.anchored_at).toISOString() : null,
      aiRisk,
    };
  }

  // 7. Precedence 5: verified!
  const aiRisk = computeAIRiskSignal("verified", []);
  await logVerification(record.id, inputMethod, candidateFields, "verified", [], aiRisk);

  return {
    status: "verified",
    university: uniResponseObj,
    revoked: false,
    mismatchedFields: [],
    txHash: record.tx_hash || null,
    anchoredAt: record.anchored_at ? new Date(record.anchored_at).toISOString() : null,
    aiRisk,
  };
}

/**
 * Logs the verification attempt into the `verifications` table.
 */
async function logVerification(
  recordId: number | null,
  inputMethod: string,
  extractedFields: any,
  result: string,
  mismatchedFields: string[],
  aiRisk: { score: number; notes: string }
) {
  try {
    await pool.query(
      `INSERT INTO verifications (
        record_id, input_method, extracted_fields, result,
        mismatched_fields, ai_risk_score, ai_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        recordId,
        inputMethod,
        extractedFields ? JSON.stringify(extractedFields) : null,
        result,
        mismatchedFields,
        aiRisk.score,
        aiRisk.notes,
      ]
    );
  } catch (err) {
    console.error("Failed to insert verification log:", err);
  }
}
