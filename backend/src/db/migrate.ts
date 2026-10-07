import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigrations() {
  try {
    const sqlPath = resolve(__dirname, '../../../docs/schema.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    console.log('Running migrations from', sqlPath);
    await pool.query(sql);
    console.log('✅ Migration completed');
  } catch (err) {
    console.error('❌ Migration failed:', (err as any).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
