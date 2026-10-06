import { MerkleTree } from "merkletreejs";
import crypto from "crypto";

export interface CertificateFields {
  reg_no: string;
  student_name: string;
  award: string;
  class_of_award: string;
  graduation_year: string | number;
  serial_no: string;
}

/**
 * Normalises a field value according to the frozen spec:
 * 1. Trim leading and trailing whitespace
 * 2. Collapse repeated whitespace to one space
 * 3. Convert to lowercase
 * 4. Normalise to Unicode NFC
 */
export function normalise(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFC");
}

/**
 * Generates 16 cryptographically random bytes as a hex string (32 hex characters).
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Computes the leaf hash for a certificate record:
 * Joins fields in order: reg_no | student_name | award | class_of_award | graduation_year | serial_no | salt
 * Returns { rawString, leaf } where leaf is 0x + 64 hex characters (SHA-256).
 */
export function computeLeaf(
  record: CertificateFields,
  salt: string
): { rawString: string; leaf: string } {
  const parts = [
    normalise(record.reg_no),
    normalise(record.student_name),
    normalise(record.award),
    normalise(record.class_of_award),
    normalise(record.graduation_year),
    normalise(record.serial_no),
    normalise(salt),
  ];
  const rawString = parts.join("|");
  const leaf =
    "0x" + crypto.createHash("sha256").update(rawString, "utf8").digest("hex");
  return { rawString, leaf };
}

function sha256(data: Buffer | string): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

/**
 * Builds a Merkle tree using merkletreejs with SHA-256, sortPairs: true, hashLeaves: false.
 */
export function buildTree(leafHexes: string[]): MerkleTree {
  const leaves = leafHexes.map((hex) =>
    Buffer.from(hex.replace(/^0x/, ""), "hex")
  );
  return new MerkleTree(leaves, sha256, {
    sortPairs: true,
    hashLeaves: false,
  });
}

/**
 * Extracts the 0x + 64 hex root string from the tree.
 * Handles single-row case where root = leaf.
 */
export function getTreeRoot(tree: MerkleTree, singleLeaf?: string): string {
  const rootBuf = tree.getRoot();
  if (rootBuf.length === 0 && singleLeaf) {
    return singleLeaf;
  }
  const hex = rootBuf.toString("hex");
  return "0x" + hex;
}

/**
 * Generates the Merkle proof for a leaf as a JSON array of 0x hex strings.
 */
export function getProof(tree: MerkleTree, leafHex: string): string[] {
  // Single-row batch has an empty proof
  if (tree.getLeaves().length <= 1) {
    return [];
  }
  const leafBuf = Buffer.from(leafHex.replace(/^0x/, ""), "hex");
  const proof = tree.getProof(leafBuf);
  return proof.map((p) => "0x" + p.data.toString("hex"));
}

/**
 * Verifies a Merkle proof against a root.
 * Supports both multi-leaf proofs and single-row batches (empty proof, root == leaf).
 */
export function verifyProof(
  proof: string[],
  leafHex: string,
  rootHex: string
): boolean {
  if (!leafHex || !rootHex) return false;
  const normLeaf = leafHex.toLowerCase();
  const normRoot = rootHex.toLowerCase();

  // Single-row case: proof is empty, leaf must equal root
  if (proof.length === 0) {
    return normLeaf === normRoot;
  }

  const leafBuf = Buffer.from(normLeaf.replace(/^0x/, ""), "hex");
  const rootBuf = Buffer.from(normRoot.replace(/^0x/, ""), "hex");
  const formattedProof = proof.map((p) => ({
    data: Buffer.from(p.replace(/^0x/, ""), "hex"),
  }));

  return MerkleTree.verify(formattedProof, leafBuf, rootBuf, sha256, {
    sortPairs: true,
    hashLeaves: false,
  });
}
