import type { FileContentConfig, CompressionResult } from '../types';
import { countTokens, estimateReduction } from '../utils/token-counter';
import { generateCompressionMarker } from '../utils/marker';

const SAFE_LANGUAGES = ['.ts', '.tsx', '.js', '.jsx', '.py'];
const MIN_SIZE_FOR_STRIP = 1024;

export function shouldStrip(filepath: string, contentBytes: number): boolean {
  const ext = filepath.slice(filepath.lastIndexOf('.')).toLowerCase();
  if (!SAFE_LANGUAGES.includes(ext)) return false;
  if (contentBytes < MIN_SIZE_FOR_STRIP) return false;
  return true;
}

export function stripComments(content: string): string {
  const lines = content.split('\n');
  return lines.map(stripCommentsFromLine).join('\n');
}

function stripCommentsFromLine(line: string): string {
  const stringRanges = findStringRanges(line);

  // Block comment /* ... */ (might span multiple lines, but per-line approach handles inline)
  let result = line;
  result = stripBlockCommentsInLine(result, stringRanges);

  // Recompute string ranges after block stripping (positions shift)
  const updatedRanges = findStringRanges(result);

  // Single-line comment //
  let result2 = result;
  let commentStart = -1;
  for (let i = 0; i < result2.length - 1; i++) {
    if (result2[i] === '/' && result2[i + 1] === '/') {
      const insideString = updatedRanges.some(([start, end]) => i >= start && i < end);
      if (!insideString) {
        commentStart = i;
        break;
      }
    }
  }
  if (commentStart >= 0) {
    return result2.slice(0, commentStart).trimEnd();
  }
  return result2;
}

function findStringRanges(line: string): [number, number][] {
  const ranges: [number, number][] = [];
  const stringRegex = /(['"`])((?:\\\1|(?!\1).)*?)\1/g;
  let m;
  while ((m = stringRegex.exec(line)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function stripBlockCommentsInLine(line: string, stringRanges: [number, number][]): string {
  // Find /* ... */ not inside strings
  let result = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '/' && line[i + 1] === '*') {
      const insideString = stringRanges.some(([start, end]) => i >= start && i < end);
      if (insideString) {
        result += line[i];
        i++;
        continue;
      }
      // Find closing */
      let end = line.indexOf('*/', i + 2);
      if (end === -1) {
        // Block comment continues to next line; replace with space
        result += ' ';
        i = line.length;
      } else {
        result += ' ';
        i = end + 2;
      }
    } else {
      result += line[i];
      i++;
    }
  }
  return result;
}

export function compressFileContent(
  filepath: string,
  content: string,
  config: FileContentConfig
): CompressionResult {
  if (!config.enabled) {
    const tokens = countTokens(content);
    return { original: content, compressed: content, originalTokens: tokens, compressedTokens: tokens, ratio: 0, method: 'none' };
  }

  const contentBytes = Buffer.byteLength(content, 'utf-8');
  if (!shouldStrip(filepath, contentBytes)) {
    const tokens = countTokens(content);
    return { original: content, compressed: content, originalTokens: tokens, compressedTokens: tokens, ratio: 0, method: 'none' };
  }

  // Skip template-heavy files (heuristic: > 10 backticks)
  const backtickCount = (content.match(/`/g) || []).length;
  if (backtickCount > 10) {
    const tokens = countTokens(content);
    return { original: content, compressed: content, originalTokens: tokens, compressedTokens: tokens, ratio: 0, method: 'none' };
  }

  const originalTokens = countTokens(content);
  const compressed = stripComments(content);
  const compressedTokens = countTokens(compressed);
  const ratio = estimateReduction(originalTokens, compressedTokens);

  return {
    original: content,
    compressed,
    originalTokens,
    compressedTokens,
    ratio,
    method: 'strip',
    marker: generateCompressionMarker('L2', ratio, originalTokens, compressedTokens),
  };
}
