// Usage: npm run demo:register -- <id> "<label>" <imagePath>
// e.g.   npm run demo:register -- genuine "Genuine certificate" "C:\demo\genuine.jpg"
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { extractFieldsFromImage } from '../services/ai';
import { saveDemo, sha256 } from '../services/demoCache';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

(async () => {
  const [id, label, imagePath] = process.argv.slice(2);
  if (!id || !label || !imagePath || !fs.existsSync(imagePath)) {
    console.error('Usage: npm run demo:register -- <id> "<label>" <imagePath>');
    process.exit(1);
  }
  const buf = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  console.log(`Reading "${id}" with the live AI (demo fixtures bypassed)...`);
  const r = await extractFieldsFromImage(buf, mime, { skipDemo: true });
  saveDemo({ id, label, sha256: sha256(buf), result: { fields: r.fields, confidence: r.confidence } });

  console.log(`Saved via ${r.provider}. Review and correct data/demo-fixtures.json:`);
  console.table(r.fields);
  if (r.needsManualEntry || r.provider === 'tesseract') {
    console.warn('The AI could not read this image well. Edit the fields in data/demo-fixtures.json by hand to match what is printed on the certificate.');
  }
  console.log('Fields must match what the IMAGE shows (the tampered one keeps the tampered class), so the demo stays honest.');
})();
