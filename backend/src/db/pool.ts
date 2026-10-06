import { Pool, PoolConfig } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = process.env.DATABASE_URL;

const isRemote =
  connectionString?.includes("supabase") ||
  connectionString?.includes("render.com") ||
  connectionString?.includes("pooler.supabase.com") ||
  process.env.NODE_ENV === "production";

const poolConfig: PoolConfig = {
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
};

export const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

export async function testConnection(): Promise<boolean> {
  if (!connectionString) {
    console.warn("DATABASE_URL is not set.");
    return false;
  }
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT NOW()");
    client.release();
    return !!res.rows[0];
  } catch (err) {
    console.error("Database connection failed:", err);
    return false;
  }
}
