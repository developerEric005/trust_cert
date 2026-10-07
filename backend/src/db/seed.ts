/**
 * Database seed script for Person B.
 *
 * Seeds:
 *   1. Universities (3 accredited, 1 pending/unaccredited, 1 fake)
 *   2. An admin user
 *   3. Registrar users for each university
 *   4. A batch of 30 graduate records (for University of Nairobi) with salts, leaf hashes, and Merkle proofs
 *
 * Run: npm run seed
 * Requires: DATABASE_URL in .env
 */
import pool from './pool';
import { computeLeaf, generateSalt, sha256ForMerkle, normaliseField } from '../utils/hash';
import { MerkleTree } from 'merkletreejs';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

// ─── Demo data ──────────────────────────────────────────────────────

const UNIVERSITIES = [
  { name: 'University of Nairobi', cue_charter_ref: 'UoN/CH/001', wallet_address: '0x1111111111111111111111111111111111111111', accredited: true, status: 'approved' },
  { name: 'Kenyatta University', cue_charter_ref: 'KU/CH/002', wallet_address: '0x2222222222222222222222222222222222222222', accredited: true, status: 'approved' },
  { name: 'Meru University of Science and Technology', cue_charter_ref: 'MUST/CH/003', wallet_address: '0x3333333333333333333333333333333333333333', accredited: true, status: 'approved' },
  { name: 'Jomo Kenyatta University of Agriculture and Technology', cue_charter_ref: 'JKUAT/CH/004', wallet_address: '0x4444444444444444444444444444444444444444', accredited: true, status: 'approved' },
  { name: 'Fake Academy of Excellence', cue_charter_ref: null, wallet_address: null, accredited: false, status: 'pending' },
];

const ADMIN_USER = { email: 'admin@trustcert.ke', password: 'admin123', role: 'admin' };

// 30 demo graduates (all from University of Nairobi, id=1)
const GRADUATES = [
  { reg_no: 'B131/1001/2021', student_name: 'Amina Wanjiku Muthoni', programme: 'Bachelor of Science in Computer Science', award: 'Bachelor of Science', class_of_award: 'First Class Honours', graduation_year: 2025, serial_no: 'UON-CS-2025-001' },
  { reg_no: 'B131/1002/2021', student_name: 'Brian Kipchoge Korir', programme: 'Bachelor of Science in Computer Science', award: 'Bachelor of Science', class_of_award: 'Second Class Upper Division', graduation_year: 2025, serial_no: 'UON-CS-2025-002' },
  { reg_no: 'B131/1003/2021', student_name: 'Catherine Nyambura Kamau', programme: 'Bachelor of Science in Computer Science', award: 'Bachelor of Science', class_of_award: 'Second Class Upper Division', graduation_year: 2025, serial_no: 'UON-CS-2025-003' },
  { reg_no: 'B131/1004/2021', student_name: 'David Ochieng Otieno', programme: 'Bachelor of Science in Computer Science', award: 'Bachelor of Science', class_of_award: 'Second Class Lower Division', graduation_year: 2025, serial_no: 'UON-CS-2025-004' },
  { reg_no: 'B131/1005/2021', student_name: 'Elizabeth Wangari Njeri', programme: 'Bachelor of Science in Computer Science', award: 'Bachelor of Science', class_of_award: 'First Class Honours', graduation_year: 2025, serial_no: 'UON-CS-2025-005' },
  { reg_no: 'B132/2001/2020', student_name: 'Francis Mutua Kioko', programme: 'Bachelor of Commerce', award: 'Bachelor of Commerce', class_of_award: 'Second Class Upper Division', graduation_year: 2024, serial_no: 'UON-COM-2024-001' },
  { reg_no: 'B132/2002/2020', student_name: 'Grace Akinyi Odhiambo', programme: 'Bachelor of Commerce', award: 'Bachelor of Commerce', class_of_award: 'Pass', graduation_year: 2024, serial_no: 'UON-COM-2024-002' },
  { reg_no: 'B132/2003/2020', student_name: 'Hassan Ali Mohamed', programme: 'Bachelor of Commerce', award: 'Bachelor of Commerce', class_of_award: 'Second Class Upper Division', graduation_year: 2024, serial_no: 'UON-COM-2024-003' },
  { reg_no: 'B132/2004/2020', student_name: 'Irene Njoki Waweru', programme: 'Bachelor of Commerce', award: 'Bachelor of Commerce', class_of_award: 'First Class Honours', graduation_year: 2024, serial_no: 'UON-COM-2024-004' },
  { reg_no: 'B132/2005/2020', student_name: 'James Mwangi Kariuki', programme: 'Bachelor of Commerce', award: 'Bachelor of Commerce', class_of_award: 'Second Class Lower Division', graduation_year: 2024, serial_no: 'UON-COM-2024-005' },
  { reg_no: 'B133/3001/2021', student_name: 'Khadija Fatuma Hassan', programme: 'Bachelor of Laws', award: 'Bachelor of Laws', class_of_award: 'Second Class Upper Division', graduation_year: 2025, serial_no: 'UON-LAW-2025-001' },
  { reg_no: 'B133/3002/2021', student_name: 'Leonard Kiprop Cheruiyot', programme: 'Bachelor of Laws', award: 'Bachelor of Laws', class_of_award: 'First Class Honours', graduation_year: 2025, serial_no: 'UON-LAW-2025-002' },
  { reg_no: 'B133/3003/2021', student_name: 'Martha Achieng Okello', programme: 'Bachelor of Laws', award: 'Bachelor of Laws', class_of_award: 'Second Class Lower Division', graduation_year: 2025, serial_no: 'UON-LAW-2025-003' },
  { reg_no: 'B133/3004/2021', student_name: 'Nicholas Wafula Simiyu', programme: 'Bachelor of Laws', award: 'Bachelor of Laws', class_of_award: 'Pass', graduation_year: 2025, serial_no: 'UON-LAW-2025-004' },
  { reg_no: 'B133/3005/2021', student_name: 'Olive Cherono Bett', programme: 'Bachelor of Laws', award: 'Bachelor of Laws', class_of_award: 'Second Class Upper Division', graduation_year: 2025, serial_no: 'UON-LAW-2025-005' },
  { reg_no: 'B134/4001/2020', student_name: 'Patrick Njoroge Maina', programme: 'Bachelor of Medicine and Surgery', award: 'Bachelor of Medicine', class_of_award: 'Distinction', graduation_year: 2025, serial_no: 'UON-MED-2025-001' },
  { reg_no: 'B134/4002/2020', student_name: 'Queen Nafula Wekesa', programme: 'Bachelor of Medicine and Surgery', award: 'Bachelor of Medicine', class_of_award: 'Credit', graduation_year: 2025, serial_no: 'UON-MED-2025-002' },
  { reg_no: 'B134/4003/2020', student_name: 'Robert Omondi Owino', programme: 'Bachelor of Medicine and Surgery', award: 'Bachelor of Medicine', class_of_award: 'Distinction', graduation_year: 2025, serial_no: 'UON-MED-2025-003' },
  { reg_no: 'B134/4004/2020', student_name: 'Sarah Wanjiru Githinji', programme: 'Bachelor of Medicine and Surgery', award: 'Bachelor of Medicine', class_of_award: 'Pass', graduation_year: 2025, serial_no: 'UON-MED-2025-004' },
  { reg_no: 'B134/4005/2020', student_name: 'Thomas Kiplagat Ruto', programme: 'Bachelor of Medicine and Surgery', award: 'Bachelor of Medicine', class_of_award: 'Credit', graduation_year: 2025, serial_no: 'UON-MED-2025-005' },
  { reg_no: 'B135/5001/2021', student_name: 'Umi Halima Abdi', programme: 'Bachelor of Education', award: 'Bachelor of Education', class_of_award: 'Second Class Upper Division', graduation_year: 2025, serial_no: 'UON-EDU-2025-001' },
  { reg_no: 'B135/5002/2021', student_name: 'Victor Musyoka Mutinda', programme: 'Bachelor of Education', award: 'Bachelor of Education', class_of_award: 'First Class Honours', graduation_year: 2025, serial_no: 'UON-EDU-2025-002' },
  { reg_no: 'B135/5003/2021', student_name: 'Wanjiku Mwende Mutisya', programme: 'Bachelor of Education', award: 'Bachelor of Education', class_of_award: 'Second Class Lower Division', graduation_year: 2025, serial_no: 'UON-EDU-2025-003' },
  { reg_no: 'B135/5004/2021', student_name: 'Xavier Ogutu Nyong\'o', programme: 'Bachelor of Education', award: 'Bachelor of Education', class_of_award: 'Pass', graduation_year: 2025, serial_no: 'UON-EDU-2025-004' },
  { reg_no: 'B135/5005/2021', student_name: 'Yusuf Ibrahim Noor', programme: 'Bachelor of Education', award: 'Bachelor of Education', class_of_award: 'Second Class Upper Division', graduation_year: 2025, serial_no: 'UON-EDU-2025-005' },
  { reg_no: 'B136/6001/2019', student_name: 'Zipporah Wambui Kinyanjui', programme: 'Bachelor of Engineering in Electrical', award: 'Bachelor of Engineering', class_of_award: 'First Class Honours', graduation_year: 2024, serial_no: 'UON-ENG-2024-001' },
  { reg_no: 'B136/6002/2019', student_name: 'Abel Makau Ndunda', programme: 'Bachelor of Engineering in Electrical', award: 'Bachelor of Engineering', class_of_award: 'Second Class Upper Division', graduation_year: 2024, serial_no: 'UON-ENG-2024-002' },
  { reg_no: 'B136/6003/2019', student_name: 'Beatrice Nyokabi Mwangi', programme: 'Bachelor of Engineering in Electrical', award: 'Bachelor of Engineering', class_of_award: 'Second Class Lower Division', graduation_year: 2024, serial_no: 'UON-ENG-2024-003' },
  { reg_no: 'B136/6004/2019', student_name: 'Charles Kimani Ngugi', programme: 'Bachelor of Engineering in Electrical', award: 'Bachelor of Engineering', class_of_award: 'Pass', graduation_year: 2024, serial_no: 'UON-ENG-2024-004' },
  { reg_no: 'B136/6005/2019', student_name: 'Diana Moraa Nyamweya', programme: 'Bachelor of Engineering in Electrical', award: 'Bachelor of Engineering', class_of_award: 'First Class Honours', graduation_year: 2024, serial_no: 'UON-ENG-2024-005' },
];

// ─── Main seed function ─────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting database seed...\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create tables (idempotent)
    const schemaPath = path.join(__dirname, '../../../docs/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Drop tables if they exist (for re-seeding)
    await client.query('DROP TABLE IF EXISTS verifications CASCADE');
    await client.query('DROP TABLE IF EXISTS records CASCADE');
    await client.query('DROP TABLE IF EXISTS batches CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    await client.query('DROP TABLE IF EXISTS universities CASCADE');
    await client.query(schema);
    console.log('✅ Tables created');

    // 2. Insert universities
    for (const uni of UNIVERSITIES) {
      await client.query(
        `INSERT INTO universities (name, cue_charter_ref, wallet_address, accredited, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [uni.name, uni.cue_charter_ref, uni.wallet_address, uni.accredited, uni.status]
      );
    }
    console.log(` ${UNIVERSITIES.length} universities inserted`);

    // 3. Insert admin user
    const adminHash = await bcrypt.hash(ADMIN_USER.password, 10);
    await client.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)`,
      [ADMIN_USER.email, adminHash, ADMIN_USER.role]
    );

    // 4. Insert registrar users for each accredited university
    const registrars = [
      { email: 'registrar@uon.ac.ke', university_id: 1, password: 'registrar123' },
      { email: 'registrar@ku.ac.ke', university_id: 2, password: 'registrar123' },
      { email: 'registrar@must.ac.ke', university_id: 3, password: 'registrar123' },
      { email: 'registrar@jkuat.ac.ke', university_id: 4, password: 'registrar123' },
    ];
    for (const reg of registrars) {
      const regHash = await bcrypt.hash(reg.password, 10);
      await client.query(
        `INSERT INTO users (university_id, email, password_hash, role) VALUES ($1, $2, $3, 'registrar')`,
        [reg.university_id, reg.email, regHash]
      );
    }
    console.log('✅ Admin + registrar users created');

    // 5. Compute leaves and build Merkle tree for 30 graduates
    const universityId = 1; // University of Nairobi

    interface RecordWithHash {
      reg_no: string;
      student_name: string;
      programme: string;
      award: string;
      class_of_award: string;
      graduation_year: number;
      serial_no: string;
      salt: string;
      leaf_hash: string;
    }

    const records: RecordWithHash[] = GRADUATES.map(g => {
      const salt = generateSalt();
      const leaf = computeLeaf({
        reg_no: g.reg_no,
        student_name: g.student_name,
        award: g.award,
        class_of_award: g.class_of_award,
        graduation_year: g.graduation_year,
        serial_no: g.serial_no,
        salt,
      });
      return { ...g, salt, leaf_hash: leaf };
    });

    // Build Merkle tree
    const leaves = records.map(r => Buffer.from(r.leaf_hash.slice(2), 'hex'));
    const tree = new MerkleTree(leaves, sha256ForMerkle, { sortPairs: true, hashLeaves: false });
    const merkleRoot = '0x' + tree.getRoot().toString('hex');

    console.log(`\n📊 Merkle tree built:`);
    console.log(`   Root: ${merkleRoot}`);
    console.log(`   Leaves: ${leaves.length}`);

    // 6. Insert batch (simulate anchoring — tx_hash will be set by Person A)
    const { rows: batchRows } = await client.query(
      `INSERT INTO batches (university_id, merkle_root, tx_hash, block_number, record_count)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [universityId, merkleRoot, '0x_pending_anchor', null, records.length]
    );
    const batchId = batchRows[0].id;
    console.log(`✅ Batch ${batchId} created`);

    // 7. Insert records with proofs
    for (const record of records) {
      const leafBuf = Buffer.from(record.leaf_hash.slice(2), 'hex');
      const proof = tree.getProof(leafBuf).map(p => '0x' + p.data.toString('hex'));

      await client.query(
        `INSERT INTO records (batch_id, university_id, serial_no, reg_no, student_name, programme, award, class_of_award, graduation_year, salt, leaf_hash, merkle_proof)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [batchId, universityId, record.serial_no, record.reg_no, record.student_name, record.programme, record.award, record.class_of_award, record.graduation_year, record.salt, record.leaf_hash, JSON.stringify(proof)]
      );
    }
    console.log(`✅ ${records.length} records inserted with Merkle proofs`);

    // 8. Mark one record as revoked (for demo: record #7, Grace Akinyi)
    await client.query(
      `UPDATE records SET revoked = true, revoked_reason = 'Fraudulent application detected during audit'
       WHERE serial_no = 'UON-COM-2024-002' AND university_id = $1`,
      [universityId]
    );
    console.log('✅ Record UON-COM-2024-002 marked as revoked (for demo)');

    await client.query('COMMIT');

    // 9. Generate CSV file in docs/demo-data/
    const csvHeader = 'reg_no,student_name,programme,award,class_of_award,graduation_year,serial_no';
    const csvRows = GRADUATES.map(g =>
      `${g.reg_no},${g.student_name},${g.programme},${g.award},${g.class_of_award},${g.graduation_year},${g.serial_no}`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');
    const csvPath = path.join(__dirname, '../../../docs/demo-data/graduates_uon_30.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`\n📄 CSV written to: docs/demo-data/graduates_uon_30.csv`);

    // 10. Print demo-ready info
    console.log('\n' + '='.repeat(60));
    console.log('🎯 DEMO-READY DATA');
    console.log('='.repeat(60));
    console.log('\n--- Verify GENUINE (should be ✅ verified) ---');
    console.log('University ID: 1 (University of Nairobi)');
    console.log('Serial: UON-CS-2025-001');
    console.log('Name: Amina Wanjiku Muthoni');
    console.log('Award: Bachelor of Science');
    console.log('Class: First Class Honours');
    console.log('Year: 2025');
    console.log('Reg: B131/1001/2021');

    console.log('\n--- Verify MISMATCH (should be ⚠️ mismatch on class_of_award) ---');
    console.log('Same as above but change class to "Second Class Upper Division"');

    console.log('\n--- Verify REVOKED (should be 🚫 revoked) ---');
    console.log('University ID: 1');
    console.log('Serial: UON-COM-2024-002');
    console.log('Name: Grace Akinyi Odhiambo');

    console.log('\n--- Verify UNACCREDITED (should be ❌ unaccredited) ---');
    console.log('University ID: 5 (Fake Academy of Excellence)');
    console.log('Serial: FAKE-001');

    console.log('\n--- Login credentials ---');
    console.log('Admin: admin@trustcert.ke / admin123');
    console.log('UoN Registrar: registrar@uon.ac.ke / registrar123');
    console.log('\n🌱 Seed complete!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
