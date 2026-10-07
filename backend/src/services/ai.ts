/**
 * AI Service (Person B).
 *
 * Extracts certificate fields from a photo/PDF. Provider chain:
 *   1. Demo fixtures (the 3 fake demo certificates, matched by image hash; works offline)
 *   2. Gemini vision (tries each model in GEMINI_MODELS, with retries)
 *   3. Claude vision (only if ANTHROPIC_API_KEY is set; optional, paid)
 *   4. Tesseract.js OCR (last resort; flags needsManualEntry when it finds nothing)
 *
 * .env:
 *   GEMINI_API_KEY=...
 *   GEMINI_MODELS=<main-model-id>,<lighter-model-id>   # check IDs in Google AI Studio
 *   ANTHROPIC_API_KEY=                                   # optional
 *   CLAUDE_MODEL=claude-haiku-4-5-20251001               # optional
 */
import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'tesseract.js';
import { findDemoByImage } from './demoCache';

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
  provider: 'claude' | 'gemini' | 'tesseract' | 'demo';
  model?: string;
  raw_text?: string;
  /** true when no provider could read any field: the UI should ask the user to type them */
  needsManualEntry?: boolean;
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

// ─── Helpers ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Retry on overload/rate-limit/network errors only. Auth or bad-request errors fail immediately. */
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const cause = e?.cause?.code || e?.cause?.message || e?.name || '';
      const status: number | undefined = e?.status;
      const retryable = status === undefined || [429, 500, 502, 503, 504].includes(status);
      console.warn(`[AI] ${label} attempt ${i}/${tries} failed: ${String(e.message).slice(0, 140)} ${cause ? `(cause: ${cause})` : ''}`);
      if (!retryable || i === tries) break;
      await sleep(1000 * 2 ** (i - 1)); // 1s, 2s, 4s
    }
  }
  throw lastErr;
}

function emptyFields(): ExtractedFields {
  return { reg_no: '', student_name: '', award: '', class_of_award: '', graduation_year: '', serial_no: '', university_name: '' };
}

function hasAnyField(f: ExtractedFields): boolean {
  return Object.values(f).some(v => String(v).trim() !== '');
}

/** Pull the JSON object out of a model reply and map it to our fields. */
function parseModelJson(text: string): { fields: ExtractedFields; confidence: number } {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Model did not return JSON');
  const p = JSON.parse(m[0]);
  return {
    fields: {
      reg_no: String(p.reg_no || ''),
      student_name: String(p.student_name || ''),
      award: String(p.award || ''),
      class_of_award: String(p.class_of_award || ''),
      graduation_year: String(p.graduation_year || ''),
      serial_no: String(p.serial_no || ''),
      university_name: String(p.university_name || ''),
    },
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
  };
}

// ─── Gemini extraction ──────────────────────────────────────────────

async function geminiOnce(model: string, imageBuffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, // header, not URL, so the key stays out of logs
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBuffer.toString('base64') } },
            { text: EXTRACTION_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
      }),
    }
  );

  if (!response.ok) {
    throw new HttpError(response.status, `Gemini ${model} error ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const parts: any[] = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('');
  const { fields, confidence } = parseModelJson(text);
  return { fields, confidence, provider: 'gemini', model };
}

async function extractWithGemini(imageBuffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  // Put the model IDs from Google AI Studio in GEMINI_MODELS (comma-separated). Tries each in order.
  const models = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.5-flash-lite')
    .split(',').map(s => s.trim()).filter(Boolean);

  const errors: string[] = [];
  for (const model of models) {
    try {
      console.log(`[AI] Trying Gemini model: ${model}`);
      return await withRetry(`Gemini ${model}`, () => geminiOnce(model, imageBuffer, mimeType));
    } catch (e: any) {
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error(`All Gemini models failed. ${errors.join(' | ')}`);
}

// ─── Claude extraction (optional, paid) ─────────────────────────────

async function extractWithClaude(imageBuffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000 });
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') } },
        { type: 'text', text: EXTRACTION_PROMPT },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const { fields, confidence } = parseModelJson(text);
  return { fields, confidence, provider: 'claude', model };
}

// ─── Tesseract fallback ─────────────────────────────────────────────

async function extractWithTesseract(imageBuffer: Buffer): Promise<ExtractionResult> {
  const { data } = await Tesseract.recognize(imageBuffer, 'eng'); // accepts a Buffer directly, no temp file needed
  const fields = parseOcrText(data.text);
  return {
    fields,
    confidence: data.confidence / 100,
    provider: 'tesseract',
    raw_text: data.text,
    needsManualEntry: !hasAnyField(fields),
  };
}

/** Best-effort regex parsing of OCR text. Lower accuracy than vision models. */
function parseOcrText(text: string): ExtractedFields {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const uniLine = lines.find(l => /university|college|polytechnic/i.test(l)) || '';
  const regMatch = text.match(/reg(?:istration)?\.?\s*(?:no|number)?\.?\s*:?\s*([A-Z0-9/\-]+)/i);
  const serialMatch = text.match(/serial\.?\s*(?:no|number)?\.?\s*:?\s*([A-Z0-9/\-]+)/i)
    || text.match(/cert(?:ificate)?\.?\s*(?:no|number)?\.?\s*:?\s*([A-Z0-9/\-]+)/i);
  const yearMatch = text.match(/(?:graduat\w*|class of|year)\s*(?:of|:)?\s*(20\d{2}|19\d{2})/i)
    || text.match(/(20\d{2}|19\d{2})/);
  const awardMatch = text.match(/(?:degree|diploma|award(?:ed)?|bachelor|master|doctor)\s*(?:of|in)?\s*(.+?)(?:\n|$)/i);
  const classMatch = text.match(/(?:first class|second class upper|second class lower|upper division|lower division|distinction|credit|merit|pass)/i);
  const nameMatch = text.match(/(?:certify that|awarded to|conferred (?:on|upon))\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:has|the|a)\s)/i);

  return {
    ...emptyFields(),
    reg_no: regMatch?.[1]?.trim() || '',
    student_name: nameMatch?.[1]?.trim() || '',
    award: awardMatch?.[1]?.trim() || '',
    class_of_award: classMatch?.[0]?.trim() || '',
    graduation_year: yearMatch?.[1] || '',
    serial_no: serialMatch?.[1]?.trim() || '',
    university_name: uniLine,
  };
}

// ─── Provider chain ─────────────────────────────────────────────────

export async function extractFieldsFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  opts: { skipDemo?: boolean } = {}
): Promise<ExtractionResult> {
  // 0. Demo fixture: the exact demo image is recognised by hash, so the live demo never depends on an API
  if (!opts.skipDemo) {
    const demo = findDemoByImage(imageBuffer);
    if (demo) {
      console.log(`[AI] Demo fixture hit: ${demo.id}`);
      return { ...demo.result, provider: 'demo' };
    }
  }

  const errors: string[] = [];

  // 1. Gemini
  if (process.env.GEMINI_API_KEY) {
    try { return await extractWithGemini(imageBuffer, mimeType); }
    catch (e: any) { console.warn('[AI] Gemini failed:', e.message); errors.push(e.message); }
  } else {
    errors.push('Gemini: GEMINI_API_KEY not set');
  }

  // 2. Claude (optional, paid)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[AI] Trying Claude...');
      return await withRetry('Claude', () => extractWithClaude(imageBuffer, mimeType), 2);
    } catch (e: any) { console.warn('[AI] Claude failed:', e.message); errors.push(`Claude: ${e.message}`); }
  }

  // 3. Tesseract (may return needsManualEntry)
  try {
    console.log('[AI] Falling back to Tesseract OCR...');
    return await extractWithTesseract(imageBuffer);
  } catch (e: any) {
    errors.push(`Tesseract: ${e.message}`);
  }

  throw new Error(`All extraction providers failed: ${errors.join('; ')}`);
}

// ─── Risk assessment ────────────────────────────────────────────────
// Each warning sign has a weight; weights are combined so several signs raise the score
// without ever exceeding 1.0. The result is a risk SIGNAL, never proof of forgery.

const FIELD_LABELS: Record<string, string> = {
  reg_no: 'registration number',
  student_name: 'student name',
  award: 'award',
  class_of_award: 'class of award',
  graduation_year: 'graduation year',
  serial_no: 'serial number',
};
const label = (f: string) => FIELD_LABELS[f] ?? f.replace(/_/g, ' ');

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

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
  const weights: number[] = [];
  const findings: string[] = [];

  if (params.revoked) {
    weights.push(0.9);
    findings.push('The issuing university has revoked this certificate. It should not be relied upon.');
  }

  if (!params.storedRecord) {
    weights.push(0.7);
    findings.push(
      'No matching record was found in the registry. The certificate may not have been issued by this university, ' +
      'may pre-date its registry, or its details may have been misread. Confirm the serial number and university.'
    );
  } else if (params.mismatchedFields.length > 0) {
    const n = params.mismatchedFields.length;
    weights.push(Math.min(0.5 + 0.15 * n, 0.9));
    findings.push(
      `The ${joinList(params.mismatchedFields.map(label))} ${n === 1 ? 'does' : 'do'} not match the record anchored by the issuing university. ` +
      'This is consistent with alteration, but can also result from a misread image, so check against the original document.'
    );
  }

  if (!params.universityAccredited) {
    weights.push(0.65);
    findings.push('The issuing institution is not on the accredited list, so this certificate cannot be treated as a recognised qualification.');
  }

  const pct = Math.round(params.confidence * 100);
  if (params.confidence < 0.5) {
    weights.push(0.2);
    findings.push(`Image quality was low (reading confidence ${pct}%). Please check the extracted details before relying on this result.`);
  } else if (params.confidence < 0.75) {
    weights.push(0.1);
    findings.push(`Image quality was moderate (reading confidence ${pct}%). Some details may have been misread.`);
  }

  const score = Math.round((1 - weights.reduce((p, w) => p * (1 - w), 1)) * 100) / 100;

  const headline =
    score >= 0.6 ? 'HIGH RISK: do not accept this certificate without direct confirmation from the issuing university.'
      : score >= 0.3 ? 'MEDIUM RISK: some checks need attention before this certificate is accepted.'
        : findings.length === 0 ? 'LOW RISK: no warning signs were detected.'
          : 'LOW RISK: the record checks passed, but please note the following.';

  const closing = findings.length === 0 || score < 0.3
    ? 'The submitted details match the record anchored by an accredited university, and it has not been revoked. ' +
    'Note that the blockchain confirms the record was not altered after anchoring; it cannot confirm that the registrar entered accurate data.'
    : 'This is an automated risk signal, not proof of forgery. For high-stakes decisions, confirm directly with the issuing university\'s registrar.';

  const body = [headline, ...findings, closing].join(' ');
  return { score, notes: body };
}
