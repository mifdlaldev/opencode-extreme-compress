import type { VerificationResult } from '../types';

export function buildSummarizationPrompt(userTurns: string, assistantTurns: string): string {
  return `You are summarizing a conversation. Your summary will be used as context for future turns.

CRITICAL: You MUST include verbatim:
- All file paths mentioned (preserve full path, don't abbreviate)
- All function/class/variable names (preserve exact identifiers)
- All error messages and error codes (preserve exact text)
- All numeric values (line numbers, counts, IDs)
- All decisions made and their rationale

Format as bullet points grouped by topic.
Mark anything you are uncertain about as [UNCERTAIN: ...]

=== USER TURNS ===
${userTurns}

=== ASSISTANT TURNS ===
${assistantTurns}

=== SUMMARY (bullet points, preserving critical details) ===
`;
}

export function extractPaths(text: string): string[] {
  const paths = new Set<string>();

  const relativePathRegex = /\b(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+\b/g;
  let m;
  while ((m = relativePathRegex.exec(text)) !== null) {
    paths.add(m[0]);
  }

  const absolutePathRegex = /(?<![a-zA-Z0-9])\/[a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+\b/g;
  while ((m = absolutePathRegex.exec(text)) !== null) {
    paths.add(m[0]);
  }

  return Array.from(paths);
}

const COMMON_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'they', 'them', 'some', 'very',
  'when', 'what', 'your', 'will', 'each', 'make', 'like', 'long', 'look', 'many',
  'time', 'come', 'here', 'just', 'know', 'take', 'people', 'into', 'year', 'good',
  'give', 'most', 'only', 'after', 'also', 'back', 'work', 'first', 'even', 'new',
  'way', 'could', 'any', 'because', 'these', 'day', 'thing', 'well', 'need', 'feel',
  'high', 'right', 'might', 'great', 'still', 'mean', 'between', 'child', 'keep',
  'never', 'under', 'last', 'place', 'case', 'point', 'world', 'life', 'part', 'eye',
  'woman', 'man', 'old', 'year', 'day', 'way', 'hand', 'far', 'big', 'small', 'next',
  'early', 'young', 'important', 'public', 'same', 'able',
]);

export function extractIdentifiers(text: string): string[] {
  const ids = new Set<string>();

  const pascalRegex = /\b[A-Z][a-zA-Z0-9]{2,}\b/g;
  let m;
  while ((m = pascalRegex.exec(text)) !== null) {
    ids.add(m[0]);
  }

  const funcCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]{2,})\s*\(/g;
  while ((m = funcCallRegex.exec(text)) !== null) {
    ids.add(m[1]);
  }

  const camelRegex = /\b[a-z][a-zA-Z0-9]{4,}\b/g;
  while ((m = camelRegex.exec(text)) !== null) {
    const word = m[0];
    if (!COMMON_WORDS.has(word.toLowerCase())) {
      ids.add(word);
    }
  }

  return Array.from(ids);
}

export function verifySummary(original: string, summary: string): VerificationResult {
  const originalPaths = extractPaths(original);
  const originalIds = extractIdentifiers(original);

  const missingPaths = originalPaths.filter((p) => !summary.includes(p));
  const missingIds = originalIds.filter((i) => !summary.includes(i));

  return {
    passed: missingPaths.length === 0 && missingIds.length === 0,
    missingPaths,
    missingIdentifiers: missingIds,
    missingErrorCodes: [],
    retried: false,
    fellBack: false,
  };
}
