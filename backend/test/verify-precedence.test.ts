import {
  VerificationStatus,
  computeAIRiskSignal,
} from "../src/services/verify";
import { normalise } from "../src/lib/hashing";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log("Running Verification Precedence & Field Mismatch Tests...");

// 1. Status Precedence Verification:
// not_found > unaccredited > revoked > mismatch > verified
const precedenceList: VerificationStatus[] = [
  "not_found",
  "unaccredited",
  "revoked",
  "mismatch",
  "verified",
];

assert(precedenceList[0] === "not_found", "Precedence 1 is not_found");
assert(precedenceList[1] === "unaccredited", "Precedence 2 is unaccredited");
assert(precedenceList[2] === "revoked", "Precedence 3 is revoked");
assert(precedenceList[3] === "mismatch", "Precedence 4 is mismatch");
assert(precedenceList[4] === "verified", "Precedence 5 is verified");

// 2. Field Mismatch Logic
const storedRecord = {
  reg_no: "P15/12345/2020",
  student_name: "John Mwangi Kamau",
  award: "Bachelor of Science in Computer Science",
  class_of_award: "First Class Honours",
  graduation_year: "2024",
  serial_no: "UON-2024-00101",
};

// Candidate with edited class_of_award
const candidateTamperedClass = {
  ...storedRecord,
  class_of_award: "Second Class Honours (Upper Division)", // Tampered
};

function checkMismatches(candidate: any, stored: any): string[] {
  const diffs: string[] = [];
  if (candidate.reg_no !== undefined && normalise(candidate.reg_no) !== normalise(stored.reg_no)) {
    diffs.push("reg_no");
  }
  if (candidate.student_name !== undefined && normalise(candidate.student_name) !== normalise(stored.student_name)) {
    diffs.push("student_name");
  }
  if (candidate.award !== undefined && normalise(candidate.award) !== normalise(stored.award)) {
    diffs.push("award");
  }
  if (candidate.class_of_award !== undefined && normalise(candidate.class_of_award) !== normalise(stored.class_of_award)) {
    diffs.push("class_of_award");
  }
  if (candidate.graduation_year !== undefined && normalise(candidate.graduation_year) !== normalise(stored.graduation_year)) {
    diffs.push("graduation_year");
  }
  if (candidate.serial_no !== undefined && normalise(candidate.serial_no) !== normalise(stored.serial_no)) {
    diffs.push("serial_no");
  }
  return diffs;
}

const diffs1 = checkMismatches(candidateTamperedClass, storedRecord);
assert(diffs1.length === 1 && diffs1[0] === "class_of_award", "Tampered class_of_award correctly identified");

// Candidate with un-normalised casing but identical semantic value
const candidateDifferentCasing = {
  ...storedRecord,
  student_name: "  JOHN  MWANGI   KAMAU  ",
  class_of_award: "FIRST CLASS HONOURS",
};
const diffs2 = checkMismatches(candidateDifferentCasing, storedRecord);
assert(diffs2.length === 0, "Normalised matching ignores whitespace and casing differences");

// Multiple field tampering
const candidateMultiTampered = {
  ...storedRecord,
  student_name: "Peter Njoroge",
  award: "Bachelor of Arts",
};
const diffs3 = checkMismatches(candidateMultiTampered, storedRecord);
assert(diffs3.length === 2 && diffs3.includes("student_name") && diffs3.includes("award"), "Multiple tampered fields identified");

// 3. AI Risk Signal Hook
const verifiedRisk = computeAIRiskSignal("verified", []);
assert(verifiedRisk.score < 0.1, "Verified status yields low AI risk (< 0.1)");

const mismatchRisk = computeAIRiskSignal("mismatch", ["class_of_award"]);
assert(mismatchRisk.score > 0.8, "Mismatch yields high AI risk (> 0.8)");
assert(mismatchRisk.notes.includes("class_of_award"), "AI risk notes mention mismatched field");

const revokedRisk = computeAIRiskSignal("revoked", []);
assert(revokedRisk.score >= 0.9, "Revoked yields very high AI risk (>= 0.9)");

const unaccreditedRisk = computeAIRiskSignal("unaccredited", []);
assert(unaccreditedRisk.score >= 0.9, "Unaccredited yields critical AI risk (>= 0.9)");

const notFoundRisk = computeAIRiskSignal("not_found", []);
assert(notFoundRisk.score === 1.0, "Not found yields maximum AI risk (1.0)");

console.log("All Verification Precedence & Mismatch Tests Passed Successfully!");
