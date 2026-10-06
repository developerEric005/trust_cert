import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { processBatchCSV } from "../services/batch";

export const batchesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

/**
 * POST /batches
 * Upload a CSV batch of certificates, validate rows, compute Merkle tree,
 * register root on-chain, and store records in PostgreSQL atomically.
 */
batchesRouter.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No CSV file uploaded. Key 'file' is required." });
      }

      // Read universityId from authenticated token (req.user) or fallback to req.body.universityId
      const universityId =
        (req as any).user?.universityId ||
        (req.body.universityId ? parseInt(req.body.universityId, 10) : null);

      if (!universityId || isNaN(universityId)) {
        return res.status(400).json({
          error: "universityId is required (must be integer provided in form-data or token)",
        });
      }

      const result = await processBatchCSV(req.file.buffer, universityId);

      return res.status(201).json({
        batchId: result.batchId,
        dbBatchId: result.dbBatchId,
        root: result.root,
        txHash: result.txHash,
        count: result.count,
      });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({
          error: err.message,
          ...(err.details && { details: err.details }),
        });
      }
      next(err);
    }
  }
);
