/**
 * Quick hash sanity test — verifies the FROZEN hashing spec.
 *
 * Run: npm run test:hash
 * No external deps needed (only crypto).
 */
import { normaliseField, buildPreimage, computeLeaf, generateSalt } from './hash';

console.log('🧪 Hash spec test\n');

// Test 1: Normalisation
console.log('--- Test 1: normaliseField ---');
const tests: Array<[string, string]> = [
  ['  Hello   World  ', 'hello world'],
  ['UPPER', 'upper'],
  ['  already lowercase ', 'already lowercase'],
  ['multiple   spaces   here', 'multiple spaces here'],
  ['café', 'café'],  // NFC should keep this as-is (already NFC)
];
let pass = 0;
for (const [input, expected] of tests) {
  const result = normaliseField(input);
  const ok = result === expected;
  console.log(`  ${ok ? '✅' : '❌'} normalise("${input}") = "${result}" ${ok ? '' : '(expected "' + expected + '")'}`);
  if (ok) pass++;
}
console.log(`  ${pass}/${tests.length} passed\n`);

// Test 2: Pre-image string
console.log('--- Test 2: buildPreimage ---');
const preimage = buildPreimage({
  reg_no: 'B131/1001/2021',
  student_name: 'Amina Wanjiku Muthoni',
  award: 'Bachelor of Science',
  class_of_award: 'First Class Honours',
  graduation_year: 2025,
  serial_no: 'UON-CS-2025-001',
  salt: 'abcdef0123456789abcdef0123456789',
});
console.log(`  Preimage: "${preimage}"`);
// Expected: all fields lowercase, joined with |
const expectedParts = [
  'b131/1001/2021',
  'amina wanjiku muthoni',
  'bachelor of science',
  'first class honours',
  '2025',
  'uon-cs-2025-001',
  'abcdef0123456789abcdef0123456789',
];
const expectedPreimage = expectedParts.join('|');
console.log(`  Expected: "${expectedPreimage}"`);
console.log(`  ${preimage === expectedPreimage ? '✅ Match' : '❌ Mismatch'}\n`);

// Test 3: Leaf hash format
console.log('--- Test 3: computeLeaf ---');
const leaf = computeLeaf({
  reg_no: 'B131/1001/2021',
  student_name: 'Amina Wanjiku Muthoni',
  award: 'Bachelor of Science',
  class_of_award: 'First Class Honours',
  graduation_year: 2025,
  serial_no: 'UON-CS-2025-001',
  salt: 'abcdef0123456789abcdef0123456789',
});
console.log(`  Leaf: ${leaf}`);
console.log(`  Starts with 0x: ${leaf.startsWith('0x') ? '✅' : '❌'}`);
console.log(`  Length 66 (0x + 64 hex): ${leaf.length === 66 ? '✅' : '❌'}`);
console.log(`  Hex only: ${/^0x[0-9a-f]{64}$/.test(leaf) ? '✅' : '❌'}\n`);

// Test 4: Salt generation
console.log('--- Test 4: generateSalt ---');
const salt1 = generateSalt();
const salt2 = generateSalt();
console.log(`  Salt 1: ${salt1}`);
console.log(`  Salt 2: ${salt2}`);
console.log(`  Length 32 (16 bytes hex): ${salt1.length === 32 ? '✅' : '❌'}`);
console.log(`  Unique: ${salt1 !== salt2 ? '✅' : '❌'}\n`);

// Test 5: Determinism — same inputs produce same leaf
console.log('--- Test 5: Determinism ---');
const leaf2 = computeLeaf({
  reg_no: 'B131/1001/2021',
  student_name: 'Amina Wanjiku Muthoni',
  award: 'Bachelor of Science',
  class_of_award: 'First Class Honours',
  graduation_year: 2025,
  serial_no: 'UON-CS-2025-001',
  salt: 'abcdef0123456789abcdef0123456789',
});
console.log(`  Leaf 1: ${leaf}`);
console.log(`  Leaf 2: ${leaf2}`);
console.log(`  ${leaf === leaf2 ? '✅ Deterministic' : '❌ Non-deterministic!'}\n`);

// Test 6: Different salt → different leaf
console.log('--- Test 6: Salt changes leaf ---');
const leafDiffSalt = computeLeaf({
  reg_no: 'B131/1001/2021',
  student_name: 'Amina Wanjiku Muthoni',
  award: 'Bachelor of Science',
  class_of_award: 'First Class Honours',
  graduation_year: 2025,
  serial_no: 'UON-CS-2025-001',
  salt: '0000000000000000000000000000000f',
});
console.log(`  Same data, diff salt: ${leafDiffSalt}`);
console.log(`  ${leaf !== leafDiffSalt ? '✅ Different' : '❌ Same (bad!)'}\n`);

console.log('🧪 Done.');
