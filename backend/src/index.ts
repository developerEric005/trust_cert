import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { app } from "./app";
import { testConnection } from "./db/pool";

const PORT = process.env.PORT || 4000;

async function startServer() {
  console.log("==========================================");
  console.log("Starting TrustCert Backend Service...");

  // Check database connectivity
  const dbOk = await testConnection();
  if (dbOk) {
    console.log("✓ PostgreSQL Database: Connected");
  } else {
    console.warn("⚠ PostgreSQL Database: Disconnected (verify DATABASE_URL)");
  }

  app.listen(PORT, () => {
    console.log(`✓ TrustCert Backend running on http://localhost:${PORT}`);
    console.log(`✓ Health endpoint: http://localhost:${PORT}/health`);
    console.log("==========================================");
  });
}

startServer().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
