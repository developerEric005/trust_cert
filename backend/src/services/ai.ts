/**
 * AI Service — Person B's core module.
 *
 * Extracts certificate fields from a photo/PDF using:
 *   1. Claude vision API (primary)
 *   2. Google Gemini vision API (secondary)
 *   3. Tesseract.js OCR (fallback)
 *
 * Also generates plain-language risk notes.
 */
import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────

export interface ExtractedFields {
  reg_no: string;
  student_name: string;
  award: string;
  class_of_award: string;
  graduation_year: string;
  serial_no: string;
  university_name: string;
}

export interface ExtractionResult {
  fields: ExtractedFields;
  confidence: number;
  provider: 'claude' | 'gemini' | 'tesseract';
  raw_text?: string;
}

export interface RiskAssessment {
  score: number;   // 0.0 (no risk) to 1.0 (high risk)
  notes: string;   // plain-language explanation
}

// ─── Extraction prompt ──────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an expert document reader for Kenyan university certificates.
Extract the following fields from this certificate image. Return ONLY a JSON object with these exact keys:

{
  "reg_no": "student registration number",
  "student_name": "full name of the student",
  "award": "the degree/diploma awarded, e.g. Bachelor of Science in Computer Science",
  "class_of_award": "classification, e.g. First Class Honours, Second Class Upper Division, Pass, Distinction",
  "graduation_year": "4-digit year of graduation",
  "serial_no": "certificate serial number",
  "university_name": "name of the issuing university",
  "confidence": 0.95
}

Rules:
- If a field is not visible or unclear, set it to an empty string "".
- The confidence score (0.0 to 1.0) reflects how clearly you could read ALL fields.
- For graduation_year, extract only the 4-digit year.
- For class_of_award, normalise to standard Kenyan classifications:
  First Class Honours, Second Class Upper Division, Second Class Lower Division, Pass, Distinction, Credit, Merit.
- Certificate serial numbers are usually printed at the bottom or on a corner.
- Return ONLY the JSON object, no markdown, no explanation.`;

// ─── Claude extraction ──────────────────────────────────────────────

async function extractWithClaude(imageBuffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const base64 = imageBuffer.toString('base64');
  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude did not return valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    fields: {
      reg_no: parsed.reg_no || '',
      student_name: parsed.student_name || '',
      award: parsed.award || '',
      class_of_award: parsed.class_of_award || '',
      graduation_year: String(parsed.graduation_year || ''),
      serial_no: parsed.serial_no || '',
      university_name: parsed.university_name || '',
    },
    confidence: parsed.confidence || 0.5,
    provider: 'claude',
  };
}

// ─── Gemini extraction ──────────────────────────────────────────────

async function extractWithGemini(imageBuffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const base64 = imageBuffer.toString('base64');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    fields: {
      reg_no: parsed.reg_no || '',
      student_name: parsed.student_name || '',
      award: parsed.award || '',
      class_of_award: parsed.class_of_award || '',
      graduation_year: String(parsed.graduation_year || ''),
      serial_no: parsed.serial_no || '',
      university_name: parsed.university_name || '',
    },
    confidence: parsed.confidence || 0.5,
    provider: 'gemini',
  };
}

// ─── Tesseract fallback ─────────────────────────────────────────────

async function extractWithTesseract(imageBuffer: Buffer): Promise<ExtractionResult> {
  // Write buffer to a temp file for Tesseract
  const tmpPath = path.join(__dirname, '../../uploads', `ocr_tmp_${Date.now()}.png`);
  fs.writeFileSync(tmpPath, imageBuffer);

  try {
    const { data } = await Tesseract.recognize(tmpPath, 'eng');
    const text = data.text;

    // Basic regex extraction from OCR text
    const fields = parseOcrText(text);

    return {
      fields,
      confidence: data.confidence / 100, // Tesseract confidence is 0-100
      provider: 'tesseract',
      raw_text: text,
    };
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

/**
 * Best-effort regex parsing of OCR text for certificate fields.
 * This is a fallback — accuracy will be lower than vision APIs.
 */
function parseOcrText(text: string): ExtractedFields {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Try to find university name (usually at the top, in caps or with "University" keyword)
  const uniLine = lines.find(l => /university|college|polytechnic/i.test(l)) || '';

  // Registration number patterns
  const regMatch = text.match(/reg(?:istration)?\.?\s*(?:no|number)?\.?\s*:?\s*([A-Z0-9/\-]+)/i);

  // Serial number patterns
  const serialMatch = text.match(/serial\.?\s*(?:no|number)?\.?\s*:?\s*([A-Z0-9/\-]+)/i)
    || text.match(/cert(?:ificate)?\.?\s*(?:no|number)?\.?\s*:?\s*([A-Z0-9/\-]+)/i);

  // Year pattern (4-digit year near "graduat" or standalone)
  const yearMatch = text.match(/(?:graduat\w*|class of|year)\s*(?:of|:)?\s*(20\d{2}|19\d{2})/i)
    || text.match(/(20\d{2}|19\d{2})/);

  // Degree/award patterns
  const awardMatch = text.match(/(?:degree|diploma|award(?:ed)?|bachelor|master|doctor)\s*(?:of|in)?\s*(.+?)(?:\n|$)/i);

  // Class of award
  const classMatch = text.match(/(?:first class|second class upper|second class lower|upper division|lower division|distinction|credit|merit|pass)/i);

  // Name — often after "This is to certify that" or "awarded to"
  const nameMatch = text.match(/(?:certify that|awarded to|conferred (?:on|upon))\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:has|the|a)\s)/i);

  return {
    reg_no: regMatch?.[1]?.trim() || '',
    student_name: nameMatch?.[1]?.trim() || '',
    award: awardMatch?.[1]?.trim() || '',
    class_of_award: classMatch?.[0]?.trim() || '',
    graduation_year: yearMatch?.[1] || '',
    serial_no: serialMatch?.[1]?.trim() || '',
    university_name: uniLine,
  };
}

// ─── Provider selection and fallback chain ───────────────────────────

export async function extractFieldsFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();
  const errors: string[] = [];

  // Try primary provider
  if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[AI] Trying Claude vision...');
      return await extractWithClaude(imageBuffer, mimeType);
    } catch (err: any) {
      console.warn('[AI] Claude failed:', err.message);
      errors.push(`Claude: ${err.message}`);
    }
  }

  // Try Gemini (secondary)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('[AI] Trying Gemini vision...');
      return await extractWithGemini(imageBuffer, mimeType);
    } catch (err: any) {
      console.warn('[AI] Gemini failed:', err.message);
      errors.push(`Gemini: ${err.message}`);
    }
  }

  // Try Claude if it wasn't primary but is available
  if (provider !== 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[AI] Trying Claude vision (secondary)...');
      return await extractWithClaude(imageBuffer, mimeType);
    } catch (err: any) {
      console.warn('[AI] Claude failed:', err.message);
      errors.push(`Claude: ${err.message}`);
    }
  }

  // Tesseract fallback (always available, no API key needed)
  try {
    console.log('[AI] Falling back to Tesseract OCR...');
    return await extractWithTesseract(imageBuffer);
  } catch (err: any) {
    console.warn('[AI] Tesseract failed:', err.message);
    errors.push(`Tesseract: ${err.message}`);
  }

  throw new Error(`All extraction providers failed: ${errors.join('; ')}`);
}

// ─── Risk assessment ────────────────────────────────────────────────

export async function generateRiskNote(params: {
  extractedFields: ExtractedFields;
  storedRecord: {
    student_name: string;
    award: string;
    class_of_award: string;
    graduation_year: number;
    serial_no: string;
    reg_no: string;
  } | null;
  universityAccredited: boolean;
  revoked: boolean;
  mismatchedFields: string[];
  confidence: number;
}): Promise<RiskAssessment> {
  let score = 0;
  const notes: string[] = [];

  // Factor 1: extraction confidence
  if (params.confidence < 0.5) {
    score += 0.2;
    notes.push('Low OCR/AI confidence — the image may be blurry or damaged.');
  } else if (params.confidence < 0.75) {
    score += 0.1;
    notes.push('Moderate OCR/AI confidence — some fields may be misread.');
  }

  // Factor 2: accreditation
  if (!params.universityAccredited) {
    score += 0.3;
    notes.push('The issuing institution is not in the accredited list. This is a significant risk signal.');
  }

  // Factor 3: revocation
  if (params.revoked) {
    score += 0.4;
    notes.push('This certificate has been revoked by the issuing university.');
  }

  // Factor 4: field mismatches
  if (params.mismatchedFields.length > 0) {
    const mismatchScore = Math.min(params.mismatchedFields.length * 0.15, 0.5);
    score += mismatchScore;
    notes.push(
      `Fields do not match the anchored record: ${params.mismatchedFields.join(', ')}. ` +
      `This may indicate alteration.`
    );
  }

  // Factor 5: not found at all
  if (!params.storedRecord) {
    score += 0.3;
    notes.push('No matching record was found in any anchored batch.');
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);
  score = Math.round(score * 100) / 100;

  // Add honest-limits disclaimer
  if (notes.length === 0) {
    notes.push(
      'All checks passed. The submitted fields match the on-chain anchored record. ' +
      'Note: blockchain proves the record was not altered after anchoring, not that the original data entered by the registrar was accurate.'
    );
  } else {
    notes.push(
      'Reminder: AI output is a risk signal, not proof. Manual verification with the issuing institution is recommended for high-stakes decisions.'
    );
  }

  return { score, notes: notes.join(' ') };
}
