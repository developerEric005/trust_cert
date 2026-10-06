/**
 * TrustCert Backend — Express application entry point.
 *
 * Person B owns: /verify/photo, /verify/check, /verify/:id/:serial, /universities
 * Person A will add: /auth/login, /admin/*, /batches, /records/:serial/revoke
 *
 * Both sets of routes are mounted here. Person A's routes are stubbed until implemented.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import verifyPhotoRouter from './routes/verifyPhoto';
import verifyCheckRouter from './routes/verifyCheck';
import { listUniversities } from './db/queries';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health check ───────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Public routes (Person B) ───────────────────────────────────────
app.use('/verify/photo', verifyPhotoRouter);    // POST /verify/photo
app.use('/verify', verifyCheckRouter);           // POST /verify/check + GET /verify/:universityId/:serial

// GET /universities (public list: id, name, accredited)
app.get('/universities', async (_req, res) => {
  try {
    const universities = await listUniversities();
    res.json(universities);
  } catch (err: any) {
    console.error('[Universities] List failed:', err);
    res.status(500).json({ error: 'Failed to list universities.' });
  }
});

// ─── Person A's routes (stubs — will be replaced) ───────────────────

// POST /auth/login
app.post('/auth/login', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet — Person A will add auth.' });
});

// POST /admin/universities/:id/approve
app.post('/admin/universities/:id/approve', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet — Person A will add admin routes.' });
});

// POST /batches
app.post('/batches', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet — Person A will add batch upload.' });
});

// POST /records/:serial/revoke
app.post('/records/:serial/revoke', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet — Person A will add revoke.' });
});

// ─── Start server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔐 TrustCert backend running on http://localhost:${PORT}`);
  console.log(`   Health: GET /health`);
  console.log(`   Photo:  POST /verify/photo`);
  console.log(`   Check:  POST /verify/check`);
  console.log(`   Serial: GET /verify/:universityId/:serial`);
  console.log(`   List:   GET /universities\n`);
});

export default app;
