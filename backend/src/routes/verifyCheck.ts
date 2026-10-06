/**
 * POST /verify/check and GET /verify/:universityId/:serial — Verification routes (Person B).
 */
import { Router, Request, Response } from 'express';
import { verifyBySerial, verifyCheck } from '../services/verify';

const router = Router();

/**
 * GET /verify/:universityId/:serial
 * Public, no auth required.
 * Used for serial lookup and QR code verification.
 */
router.get('/:universityId/:serial', async (req: Request, res: Response): Promise<void> => {
  try {
    const universityId = parseInt(req.params.universityId, 10);
    const serial = req.params.serial;

    if (isNaN(universityId)) {
      res.status(400).json({ error: 'Invalid university ID.' });
      return;
    }
    if (!serial) {
      res.status(400).json({ error: 'Serial number is required.' });
      return;
    }

    const result = await verifyBySerial(universityId, serial);
    res.json(result);
  } catch (err: any) {
    console.error('[Verify] Serial lookup failed:', err);
    res.status(500).json({ error: 'Verification failed.', details: err.message });
  }
});

/**
 * POST /verify/check
 * Body: { universityId, fields: { reg_no, student_name, award, class_of_award, graduation_year, serial_no } }
 * Public, no auth required.
 * Full layered verification from submitted fields.
 */
router.post('/check', async (req: Request, res: Response): Promise<void> => {
  try {
    const { universityId, fields, confidence } = req.body;

    if (!universityId || !fields) {
      res.status(400).json({ error: 'universityId and fields are required.' });
      return;
    }

    const requiredFields = ['reg_no', 'student_name', 'award', 'class_of_award', 'graduation_year', 'serial_no'];
    const missing = requiredFields.filter(f => !fields[f] && fields[f] !== 0);
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      return;
    }

    const result = await verifyCheck(
      parseInt(String(universityId), 10),
      fields,
      confidence ?? 1.0,
      'photo'  // input method
    );

    res.json(result);
  } catch (err: any) {
    console.error('[Verify] Check failed:', err);
    res.status(500).json({ error: 'Verification failed.', details: err.message });
  }
});

export default router;
