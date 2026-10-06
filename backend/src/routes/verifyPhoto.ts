/**
 * POST /verify/photo — AI extraction route (Person B).
 * Accepts a multipart image upload and returns extracted certificate fields.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { extractFieldsFromImage } from '../services/ai';
import { listUniversities } from '../db/queries';
import { matchUniversity } from '../services/fuzzy';

const router = Router();

// Multer config for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, WebP images and PDF files are accepted.'));
    }
  },
});

/**
 * POST /verify/photo
 * Body: multipart/form-data with field "certificate" (image file)
 * Response: { fields: ExtractedFields, confidence: number }
 */
router.post('/', upload.single('certificate'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Send a certificate image as "certificate" field.' });
      return;
    }

    console.log(`[Photo] Received ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

    // Extract fields using AI (Claude → Gemini → Tesseract fallback)
    const result = await extractFieldsFromImage(req.file.buffer, req.file.mimetype);
    console.log(`[Photo] Extracted with ${result.provider}, confidence: ${result.confidence}`);

    // Try to match the extracted university name to a known university
    let matchedUniversity: { id: number; name: string } | null = null;
    if (result.fields.university_name) {
      const universities = await listUniversities();
      const match = matchUniversity(result.fields.university_name, universities);
      if (match) {
        matchedUniversity = { id: match.id, name: match.name };
        console.log(`[Photo] Matched university: "${result.fields.university_name}" → "${match.name}" (score: ${match.score})`);
      }
    }

    res.json({
      fields: result.fields,
      confidence: result.confidence,
      provider: result.provider,
      matchedUniversity,
    });
  } catch (err: any) {
    console.error('[Photo] Extraction failed:', err);
    res.status(500).json({ error: 'Failed to extract fields from image.', details: err.message });
  }
});

export default router;
