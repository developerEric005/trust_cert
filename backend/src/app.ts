import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { testConnection } from "./db/pool";
import { chainService } from "./services/chain";

import { batchesRouter } from "./routes/batches";
import { verifyRouter } from "./routes/verify";

export const app = express();

// 1. Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  const dbConnected = await testConnection();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "TrustCert Backend Core",
    db: {
      status: dbConnected ? "connected" : "disconnected",
    },
    chain: {
      contractConfigured: !!chainService.contractAddress,
      contractAddress: chainService.contractAddress || null,
    },
  });
});

// 3. API Routes
app.use("/batches", batchesRouter);
app.use("/verify", verifyRouter);

// 4. Fallback 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// 4. Global Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});
