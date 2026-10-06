import { parse } from "csv-parse/sync";
import { pool } from "../db/pool";
import {
  CertificateFields,
  computeLeaf,
  generateSalt,
  buildTree,
  getTreeRoot,
  getProof,
} from "../lib/hashing";
import { chainService } from "./chain";

export interface CSVRecord {
  reg_no: string;
  student_name: string;
  programme: string;
  award: string;
  class_of_award: string;
  graduation_year: string;
  serial_no: string;
}

export interface BatchProcessingResult {
  batchId: number;
  dbBatchId: number;
  root: string;
  txHash: string;
  count: number;
}

export const REQUIRED_CSV_COLUMNS: (keyof CSVRecord)[] = [
  "reg_no",
  "student_name",
  "programme",
  "award",
  "class_of_award",
  "graduation_year",
  "serial_no",
];

export async function processBatchCSV(
  fileBuffer: Buffer,
  universityId: number
): Promise<BatchProcessingResult> {
  // 1. Verify university approval in DB
  const uniRes = await pool.query(
    `SELECT id, name, wallet_address, accredited, status
     FROM universities WHERE id = $1;`,
    [universityId]
  );

  if (uniRes.rows.length === 0) {
    throw { status: 404, message: `University with ID ${universityId} not found` };
  }

  const university = uniRes.rows[0];
  if (!university.accredited || university.status !== "approved") {
    throw {
      status: 403,
      message: `University '${university.name}' is unaccredited or not approved for issuing certificate batches`,
    };
  }

  // 2. Parse CSV
  let records: CSVRecord[];
  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err: any) {
    throw { status: 400, message: `Malformed CSV file: ${err.message}` };
  }

  if (!records || records.length === 0) {
    throw { status: 400, message: "CSV file contains no certificate records" };
  }

  // 3. Validate CSV Columns & Row-Numbered Data
  const validationErrors: string[] = [];
  const firstRow = records[0];
  for (const col of REQUIRED_CSV_COLUMNS) {
    if (!(col in firstRow)) {
      validationErrors.push(`Missing required CSV column: '${col}'`);
    }
  }

  if (validationErrors.length > 0) {
    throw { status: 400, message: "CSV header validation failed", details: validationErrors };
  }

  const seenSerials = new Map<string, number>();
  const serialList: string[] = [];

  records.forEach((row, idx) => {
    const rowNum = idx + 2; // Row 1 is header
    // Field validations
    if (!row.serial_no) validationErrors.push(`Row ${rowNum}: serial_no is required`);
    if (!row.reg_no) validationErrors.push(`Row ${rowNum}: reg_no is required`);
    if (!row.student_name) validationErrors.push(`Row ${rowNum}: student_name is required`);
    if (!row.award) validationErrors.push(`Row ${rowNum}: award is required`);
    if (!row.class_of_award) validationErrors.push(`Row ${rowNum}: class_of_award is required`);

    const year = Number(row.graduation_year);
    if (!row.graduation_year || isNaN(year) || year < 1900 || year > 2100) {
      validationErrors.push(`Row ${rowNum}: graduation_year must be a valid 4-digit year`);
    }

    // Check duplicate serial within the CSV itself
    if (row.serial_no) {
      const normSerial = row.serial_no.trim().toLowerCase();
      if (seenSerials.has(normSerial)) {
        const prevRow = seenSerials.get(normSerial);
        validationErrors.push(
          `Row ${rowNum}: duplicate serial_no '${row.serial_no}' already present in row ${prevRow}`
        );
      } else {
        seenSerials.set(normSerial, rowNum);
        serialList.push(row.serial_no);
      }
    }
  });

  if (validationErrors.length > 0) {
    throw {
      status: 400,
      message: "CSV validation failed with row errors",
      details: validationErrors,
    };
  }

  // 4. Check duplicate serials in PostgreSQL records table
  const dupCheckRes = await pool.query(
    `SELECT serial_no FROM records
     WHERE university_id = $1 AND serial_no = ANY($2);`,
    [universityId, serialList]
  );

  if (dupCheckRes.rows.length > 0) {
    const existingSerials = dupCheckRes.rows.map((r) => r.serial_no);
    throw {
      status: 400,
      message: "Database duplicate serial conflict",
      details: existingSerials.map(
        (s) => `Serial '${s}' already exists in the database for this university`
      ),
    };
  }

  // 5. Generate Salts, Leaves, and Merkle Tree
  interface PreparedRecord {
    original: CSVRecord;
    salt: string;
    leaf: string;
    proof: string[];
  }

  const preparedRecords: PreparedRecord[] = [];
  const leaves: string[] = [];

  for (const row of records) {
    const salt = generateSalt();
    const certFields: CertificateFields = {
      reg_no: row.reg_no,
      student_name: row.student_name,
      award: row.award,
      class_of_award: row.class_of_award,
      graduation_year: row.graduation_year,
      serial_no: row.serial_no,
    };
    const { leaf } = computeLeaf(certFields, salt);
    leaves.push(leaf);
    preparedRecords.push({
      original: row,
      salt,
      leaf,
      proof: [],
    });
  }

  // Handle single-row vs multi-row Merkle tree
  let root: string;
  if (records.length === 1) {
    root = leaves[0];
    preparedRecords[0].proof = [];
  } else {
    const tree = buildTree(leaves);
    root = getTreeRoot(tree);
    for (let i = 0; i < preparedRecords.length; i++) {
      preparedRecords[i].proof = getProof(tree, leaves[i]);
    }
  }

  // 6. Anchor Root On-Chain (Must succeed before DB write)
  let onChainBatchId = 0;
  let txHash = "";
  let blockNumber = 0;

  try {
    const chainReceipt = await chainService.registerRoot(root, records.length);
    onChainBatchId = chainReceipt.batchId;
    txHash = chainReceipt.txHash;
    blockNumber = chainReceipt.blockNumber;
  } catch (chainErr: any) {
    // If blockchain anchoring fails, NOTHING is written to DB!
    console.error("On-chain root registration failed:", chainErr);
    throw {
      status: 502,
      message: `Blockchain transaction failed: ${chainErr.message || chainErr}`,
    };
  }

  // 7. Atomic Database Transaction: Store batch + records + proofs
  const client = await pool.connect();
  let dbBatchId = 0;

  try {
    await client.query("BEGIN");

    // Insert batch record
    const batchRes = await client.query(
      `INSERT INTO batches (university_id, merkle_root, tx_hash, block_number, record_count)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [universityId, root, txHash, blockNumber, records.length]
    );
    dbBatchId = batchRes.rows[0].id;

    // Insert all certificate records
    for (const item of preparedRecords) {
      await client.query(
        `INSERT INTO records (
          batch_id, university_id, serial_no, reg_no, student_name,
          programme, award, class_of_award, graduation_year,
          salt, leaf_hash, merkle_proof
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12
        );`,
        [
          dbBatchId,
          universityId,
          item.original.serial_no,
          item.original.reg_no,
          item.original.student_name,
          item.original.programme,
          item.original.award,
          item.original.class_of_award,
          parseInt(item.original.graduation_year, 10),
          item.salt,
          item.leaf,
          JSON.stringify(item.proof),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (dbErr: any) {
    await client.query("ROLLBACK");
    console.error("Database transaction failed:", dbErr);
    throw {
      status: 500,
      message: `Database persistence failed: ${dbErr.message}`,
    };
  } finally {
    client.release();
  }

  return {
    batchId: onChainBatchId,
    dbBatchId,
    root,
    txHash,
    count: records.length,
  };
}
