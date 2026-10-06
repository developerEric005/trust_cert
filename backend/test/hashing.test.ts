import {
  normalise,
  computeLeaf,
  buildTree,
  getTreeRoot,
  getProof,
  verifyProof,
  generateSalt,
} from "../src/lib/hashing";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log("Running TrustCert Hashing Unit Tests...");

// 1. Normalisation
assert(normalise("  P15/12345/2020  ") === "p15/12345/2020", "Normalise trims and lowercases");
assert(normalise("John  Mwangi   Kamau") === "john mwangi kamau", "Normalise collapses whitespace");

// 2. Test Vector 1
const rec1 = {
  reg_no: "  P15/12345/2020  ",
  student_name: "John  Mwangi  Kamau",
  award: "Bachelor of Science in Computer Science",
  class_of_award: "First Class Honours",
  graduation_year: "2024",
  serial_no: "UON-2024-00101",
};
const salt1 = "a1b2c3d4e5f67890123456789abcdef0";
const leaf1 = computeLeaf(rec1, salt1);

assert(
  leaf1.rawString ===
    "p15/12345/2020|john mwangi kamau|bachelor of science in computer science|first class honours|2024|uon-2024-00101|a1b2c3d4e5f67890123456789abcdef0",
  "Vector 1 joined raw string matches"
);
assert(
  leaf1.leaf === "0x07701c164194d946c832f39dfdfc16235d9135ef1b43a9f5262597f07dd23eb7",
  "Vector 1 leaf hash matches spec"
);

// 3. Test Vector 2
const rec2 = {
  reg_no: "ENG/0987/2019",
  student_name: "Amina   Fatuma Hassan ",
  award: "Bachelor of Science in Civil Engineering",
  class_of_award: "Second Class Honours (Upper Division)",
  graduation_year: 2024,
  serial_no: "UON-2024-00102",
};
const salt2 = "f0e1d2c3b4a5968778695a4b3c2d1e0f";
const leaf2 = computeLeaf(rec2, salt2);

assert(
  leaf2.leaf === "0xeb656e42b1608f88824d3065cb604470dd90284a87682a88cf9dd1fa6ad98c21",
  "Vector 2 leaf hash matches spec"
);

// 4. Merkle Tree & Proofs
const tree = buildTree([leaf1.leaf, leaf2.leaf]);
const root = getTreeRoot(tree);
assert(
  root === "0x87cc6d0697f4282bbb67299edb828c4cb4891e0644b25fd26c9effa40e9a3848",
  "2-leaf Merkle root matches spec"
);

const proof1 = getProof(tree, leaf1.leaf);
assert(proof1.length === 1, "Proof 1 length is 1");
assert(verifyProof(proof1, leaf1.leaf, root) === true, "Proof 1 verifies successfully");

const proof2 = getProof(tree, leaf2.leaf);
assert(verifyProof(proof2, leaf2.leaf, root) === true, "Proof 2 verifies successfully");
assert(verifyProof(proof1, leaf2.leaf, root) === false, "Mismatched leaf fails proof verification");

// 5. Single-row batch
const singleSalt = generateSalt();
const singleLeaf = computeLeaf(rec1, singleSalt).leaf;
const singleTree = buildTree([singleLeaf]);
const singleRoot = getTreeRoot(singleTree, singleLeaf);
assert(singleRoot === singleLeaf, "Single-row root equals leaf");
const singleProof = getProof(singleTree, singleLeaf);
assert(singleProof.length === 0, "Single-row proof is empty array");
assert(verifyProof(singleProof, singleLeaf, singleRoot) === true, "Single-row proof verifies");

console.log("All Hashing Unit Tests Passed Successfully!");
