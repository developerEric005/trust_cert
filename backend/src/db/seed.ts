import bcrypt from "bcryptjs";
import { pool } from "./pool";

export async function seed() {
  console.log("Seeding initial TrustCert data...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Seed Universities
    // University 1: Accredited
    const uni1Wallet =
      process.env.TEST_UNI1_WALLET ||
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // default hardhat deployer / local test
    const uni1Res = await client.query(
      `INSERT INTO universities (name, cue_charter_ref, wallet_address, accredited, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (wallet_address) DO UPDATE
       SET name = EXCLUDED.name, accredited = EXCLUDED.accredited, status = EXCLUDED.status
       RETURNING id;`,
      ["University of Nairobi", "CUE/PROV/001", uni1Wallet.toLowerCase(), true, "approved"]
    );
    const uni1Id = uni1Res.rows[0].id;

    // University 2: Unaccredited
    const uni2Wallet =
      process.env.TEST_UNI2_WALLET ||
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const uni2Res = await client.query(
      `INSERT INTO universities (name, cue_charter_ref, wallet_address, accredited, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (wallet_address) DO UPDATE
       SET name = EXCLUDED.name, accredited = EXCLUDED.accredited, status = EXCLUDED.status
       RETURNING id;`,
      ["Great Rift University", null, uni2Wallet.toLowerCase(), false, "pending"]
    );
    const uni2Id = uni2Res.rows[0].id;

    // 2. Hash passwords
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass123!";
    const registrarPassword = process.env.REGISTRAR_PASSWORD || "UonPass123!";
    const bogusPassword = process.env.BOGUS_REGISTRAR_PASSWORD || "BogusPass123!";

    const adminHash = await bcrypt.hash(adminPassword, 10);
    const registrar1Hash = await bcrypt.hash(registrarPassword, 10);
    const registrar2Hash = await bcrypt.hash(bogusPassword, 10);

    // 3. Seed Users
    // 1 Admin user (no university_id)
    const adminEmail = process.env.ADMIN_EMAIL || "admin@trustcert.ke";
    await client.query(
      `INSERT INTO users (university_id, email, password_hash, role)
       VALUES (NULL, $1, $2, 'admin')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'admin';`,
      [adminEmail, adminHash]
    );

    // Registrar for University 1 (Accredited)
    const registrarEmail = process.env.REGISTRAR_EMAIL || "registrar@uon.ac.ke";
    await client.query(
      `INSERT INTO users (university_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'registrar')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, university_id = EXCLUDED.university_id, role = 'registrar';`,
      [uni1Id, registrarEmail, registrar1Hash]
    );

    // Registrar for University 2 (Unaccredited)
    const bogusRegistrarEmail = "registrar@bogus.ac.ke";
    await client.query(
      `INSERT INTO users (university_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'registrar')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, university_id = EXCLUDED.university_id, role = 'registrar';`,
      [uni2Id, bogusRegistrarEmail, registrar2Hash]
    );

    await client.query("COMMIT");
    console.log("Seed completed successfully:");
    console.log(`- Admin: ${adminEmail}`);
    console.log(`- University 1 (Accredited): University of Nairobi (ID: ${uni1Id}, Registrar: ${registrarEmail})`);
    console.log(`- University 2 (Unaccredited): Great Rift University (ID: ${uni2Id}, Registrar: ${bogusRegistrarEmail})`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
