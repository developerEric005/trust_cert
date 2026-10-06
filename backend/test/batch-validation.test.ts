import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { REQUIRED_CSV_COLUMNS, CSVRecord } from "../src/services/batch";
import {
  computeLeaf,
  generateSalt,
  buildTree,
  getTreeRoot,
  getProof,
  verifyProof,
} from "../src/lib/hashing";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log("Running Batch CSV & Validation Tests...");

// 1. Read sample-batch.csv
const sampleCsvPath = path.resolve(__dirname, "../../docs/sample-batch.csv");
assert(fs.existsSync(sampleCsvPath), "sample-batch.csv exists");
const sampleCsvContent = fs.readFileSync(sampleCsvPath, "utf-8");

const records: CSVRecord[] = parse(sampleCsvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

assert(records.length === 10, "sample-batch.csv has exactly 10 rows");

// 2. Validate all columns present
const first = records[0];
for (const col of REQUIRED_CSV_COLUMNS) {
  assert(col in first, `Column '${col}' present in sample CSV`);
}

// 3. Test duplicate serial detection within CSV
const csvWithDups = `reg_no,student_name,programme,award,class_of_award,graduation_year,serial_no
P15/1,Alice,CS,BSc CS,First,2024,SN-001
P15/2,Bob,CS,BSc CS,Second,2024,SN-002
P15/3,Charlie,CS,BSc CS,First,2024,SN-001`;

const parsedDups: CSVRecord[] = parse(csvWithDups, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const seenSerials = new Map<string, number>();
const dupErrors: string[] = [];
parsedDups.forEach((row, idx) => {
  const rowNum = idx + 2;
  const norm = row.serial_no.trim().toLowerCase();
  if (seenSerials.has(norm)) {
    dupErrors.push(
      `Row ${rowNum}: duplicate serial_no '${row.serial_no}' already present in row ${seenSerials.get(norm)}`
    );
  } else {
    seenSerials.set(norm, rowNum);
  }
});

assert(dupErrors.length === 1, "Detected duplicate serial in CSV");
assert(
  dupErrors[0] === "Row 4: duplicate serial_no 'SN-001' already present in row 2",
  "Error message correctly specifies row numbers"
);

// 4. Test missing field detection with row numbers
const csvWithMissing = `reg_no,student_name,programme,award,class_of_award,graduation_year,serial_no
P15/1,Alice,CS,BSc CS,First,2024,SN-001
,Bob,CS,BSc CS,First,invalid_year,`;

const parsedMissing: CSVRecord[] = parse(csvWithMissing, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const rowErrors: string[] = [];
parsedMissing.forEach((row, idx) => {
  const rowNum = idx + 2;
  if (!row.reg_no) rowErrors.push(`Row ${rowNum}: reg_no is required`);
  if (!row.serial_no) rowErrors.push(`Row ${rowNum}: serial_no is required`);
  const year = Number(row.graduation_year);
  if (!row.graduation_year || isNaN(year) || year < 1900 || year > 2100) {
    rowErrors.push(`Row ${rowNum}: graduation_year must be a valid 4-digit year`);
  }
});

assert(rowErrors.length === 3, "Captured all 3 row-level validation errors");
assert(rowErrors.includes("Row 3: reg_no is required"), "Row 3 missing reg_no detected");
assert(rowErrors.includes("Row 3: serial_no is required"), "Row 3 missing serial_no detected");
assert(
  rowErrors.includes("Row 3: graduation_year must be a valid 4-digit year"),
  "Row 3 invalid graduation_year detected"
);

// 5. Test 10-row batch tree construction and proof verification
const leaves: string[] = [];
for (const row of records) {
  const salt = generateSalt();
  const { leaf } = computeLeaf(row, salt);
  leaves.push(leaf);
}

const batchTree = buildTree(leaves);
const batchRoot = getTreeRoot(batchTree);
assert(batchRoot.startsWith("0x") && batchRoot.length === 66, "Merkle root is 0x + 64 hex chars");

for (let i = 0; i < leaves.length; i++) {
  const proof = getProof(batchTree, leaves[i]);
  assert(proof.length > 0, `Proof exists for leaf ${i}`);
  assert(verifyProof(proof, leaves[i], batchRoot) === true, `Proof verifies for leaf ${i}`);
}

console.log("All Batch CSV & Validation Tests Passed Successfully!");
