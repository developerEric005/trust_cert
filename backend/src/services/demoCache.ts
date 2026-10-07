/**
 * Demo fixtures: the 3 FAKE demo certificates (genuine, tampered, fake university).
 *
 * Each fixture stores what the AI reads from that exact image, keyed by the image's SHA-256.
 * Committed to the repo (data/demo-fixtures.json) so every teammate and the demo laptop share it.
 * Only fake certificates belong here, never real graduates' documents.
 *
 * Verification itself (database + blockchain) still runs live; only the AI *reading* is pre-recorded.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { ExtractionResult } from '../../../../backend/src/services/ai';

const FILE = path.resolve(__dirname, '../../data/demo-fixtures.json');

export interface DemoFixture {
  id: string;        // e.g. "genuine", "tampered", "fake-university"
  label: string;     // shown on the UI button
  sha256: string;    // hash of the demo image file
  result: Omit<ExtractionResult, 'provider'>;
}

export const sha256 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

function load(): DemoFixture[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')).fixtures ?? []; } catch { return []; }
}

export const listDemos = () => load().map(({ id, label }) => ({ id, label }));
export const findDemoById = (id: string) => load().find(f => f.id === id) ?? null;
export const findDemoByImage = (img: Buffer) => { const h = sha256(img); return load().find(f => f.sha256 === h) ?? null; };

export function saveDemo(fixture: DemoFixture) {
  const all = load().filter(f => f.id !== fixture.id);
  all.push(fixture);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ fixtures: all }, null, 2));
}
