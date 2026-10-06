/**
 * Fuzzy matching service using Fuse.js.
 *
 * Used to match university names from AI extraction against the DB,
 * and to compare student names accounting for typos and OCR errors.
 */
import Fuse from 'fuse.js';

export interface FuzzyMatchResult {
  matched: boolean;
  score: number;      // 0 = perfect match, 1 = no match
  bestMatch: string;
}

/**
 * Fuzzy-match a single string against a list of candidates.
 * Returns the best match and a normalised score.
 */
export function fuzzyMatch(
  query: string,
  candidates: string[],
  threshold: number = 0.4  // lower = stricter
): FuzzyMatchResult {
  if (!query || candidates.length === 0) {
    return { matched: false, score: 1, bestMatch: '' };
  }

  const fuse = new Fuse(candidates, {
    includeScore: true,
    threshold,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const results = fuse.search(query);
  if (results.length === 0) {
    return { matched: false, score: 1, bestMatch: '' };
  }

  const best = results[0];
  return {
    matched: true,
    score: best.score ?? 0,
    bestMatch: best.item,
  };
}

/**
 * Compare two name strings with fuzzy tolerance.
 * Returns true if names are "close enough" (handles OCR typos, extra spaces, etc.)
 */
export function namesMatch(name1: string, name2: string, threshold: number = 0.3): boolean {
  const n1 = name1.trim().toLowerCase().normalize('NFC');
  const n2 = name2.trim().toLowerCase().normalize('NFC');

  // Exact match
  if (n1 === n2) return true;

  // Fuzzy match
  const result = fuzzyMatch(n1, [n2], threshold);
  return result.matched && result.score < threshold;
}

/**
 * Match a university name extracted by AI against a list of known universities.
 */
export function matchUniversity(
  extractedName: string,
  universities: Array<{ id: number; name: string }>
): { id: number; name: string; score: number } | null {
  if (!extractedName) return null;

  const names = universities.map(u => u.name);
  const fuse = new Fuse(universities, {
    keys: ['name'],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
  });

  const results = fuse.search(extractedName);
  if (results.length === 0) return null;

  const best = results[0];
  return {
    id: best.item.id,
    name: best.item.name,
    score: best.score ?? 0,
  };
}
