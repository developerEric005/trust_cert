import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { extractFieldsFromImage } from '../services/ai';

// Load environment variables (for GEMINI_API_KEY)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testExtraction() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: npx tsx src/utils/testAi.ts <path-to-image>');
    process.exit(1);
  }

  const fullPath = path.resolve(imagePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`\n📷 Testing AI extraction on: ${imagePath}`);
  
  // Read the file buffer and determine mime type
  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf' 
                 : ext === '.png' ? 'image/png' 
                 : ext === '.webp' ? 'image/webp' 
                 : 'image/jpeg';

  console.log('🤖 Sending to AI (Gemini primary)...');
  try {
    const result = await extractFieldsFromImage(buffer, mimeType);
    console.log('\n✅ Extraction Successful!');
    console.log(`Provider Used: ${result.provider}`);
    console.log(`Confidence Score: ${(result.confidence * 100).toFixed(1)}%`);
    console.log('\n📊 Extracted Fields:');
    console.table(result.fields);
  } catch (err: any) {
    console.error('\n❌ Extraction Failed:');
    console.error(err.message);
  }
}

testExtraction();
