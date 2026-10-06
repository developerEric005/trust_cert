import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { verifyRecord } from "../services/verify";

export const verifyRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB photo limit
});

/**
 * GET /verify/:universityId/:serial
 * Public endpoint for QR-code or serial lookup. No login required.
 */
verifyRouter.get(
  "/:universityId/:serial",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const universityId = parseInt(req.params.universityId, 10);
      const serial = req.params.serial;

      if (isNaN(universityId) || !serial) {
        return res.status(400).json({ error: "Invalid universityId or serial parameter" });
      }

      const result = await verifyRecord(universityId, serial, undefined, "serial_lookup");
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /verify/check
 * Public layered verification check comparing candidate extracted fields against the registry.
 */
verifyRouter.post("/check", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { universityId, fields } = req.body;

    if (!universityId || isNaN(Number(universityId))) {
      return res.status(400).json({ error: "universityId is required" });
    }

    const serialNo = fields?.serial_no || req.body.serial;
    if (!serialNo) {
      return res.status(400).json({ error: "serial_no is required in fields" });
    }

    const result = await verifyRecord(
      Number(universityId),
      serialNo,
      fields,
      req.body.inputMethod || "manual_check"
    );

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /verify/photo
 * Person B AI Extraction Stub:
 * Extracts certificate fields from photo. Person B replaces this stub with their OCR/LLM model.
 */
verifyRouter.post(
  "/photo",
  upload.single("image"),
  async (req: Request, res: Response) => {
    // Stub response for Person B integration
    return res.json({
      fields: {
        reg_no: "P15/12345/2020",
        student_name: "John Mwangi Kamau",
        award: "Bachelor of Science in Computer Science",
        class_of_award: "First Class Honours",
        graduation_year: 2024,
        serial_no: "UON-2024-00101",
        university_name: "University of Nairobi",
      },
      confidence: 0.96,
      notes: "Mock AI extraction completed (Person B hook)",
    });
  }
);
