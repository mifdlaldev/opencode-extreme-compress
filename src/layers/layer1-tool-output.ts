import type { ToolOutputConfig, CompressionResult } from '../types';
import { countTokens, estimateReduction } from '../utils/token-counter';
import {
  generateLineTruncationMarker,
  generateByteTruncationMarker,
  generateCompressionMarker,
} from '../utils/marker';

export function compressToolOutput(
  input: string,
  toolName: string,
  config: ToolOutputConfig
): CompressionResult {
  if (!config.enabled) {
    return createNoopResult(input);
  }

  const originalTokens = countTokens(input);
  const lines = input.split('\n');
  const totalLines = lines.length;
  const totalBytes = Buffer.byteLength(input, 'utf-8');

  // Byte truncation takes priority (it's more aggressive)
  if (totalBytes > config.maxBytes) {
    return truncateByBytes(input, lines, config, originalTokens, totalBytes);
  }

  if (totalLines > config.headLines + config.tailLines) {
    return truncateByLines(input, lines, config, originalTokens, totalLines);
  }

  return createNoopResult(input);
}

function truncateByLines(
  input: string,
  lines: string[],
  config: ToolOutputConfig,
  originalTokens: number,
  totalLines: number
): CompressionResult {
  const { headLines, tailLines, preservePatterns } = config;

  const headSlice = lines.slice(0, headLines);
  const tailSlice = lines.slice(-tailLines);

  // Find preserved lines in the middle
  const middleStart = headLines;
  const middleEnd = totalLines - tailLines;
  const middleSlice = lines.slice(middleStart, middleEnd);

  const preservedMiddle: { line: string; index: number }[] = [];
  const patterns = preservePatterns.map((p) => {
    if (p.startsWith('(?i)')) {
      return new RegExp(p.slice(4), 'gim');
    }
    return new RegExp(p, 'gm');
  });

  middleSlice.forEach((line, i) => {
    if (patterns.some((p) => p.test(line))) {
      preservedMiddle.push({ line, index: middleStart + i });
    }
  });

  const hiddenLines = middleSlice.length - preservedMiddle.length;
  const marker = generateLineTruncationMarker(hiddenLines, middleStart + 1, middleEnd);

  const parts: string[] = [headSlice.join('\n')];
  if (preservedMiddle.length > 0) {
    parts.push(`[... ${hiddenLines} lines hidden, ${preservedMiddle.length} preserved ...]`);
    parts.push(preservedMiddle.map((p) => p.line).join('\n'));
  } else {
    parts.push(marker);
  }
  parts.push(tailSlice.join('\n'));

  const compressed = parts.join('\n');
  const compressedTokens = countTokens(compressed);
  const ratio = estimateReduction(originalTokens, compressedTokens);

  return {
    original: input,
    compressed,
    originalTokens,
    compressedTokens,
    ratio,
    method: 'truncate',
    marker: generateCompressionMarker('L1', ratio, originalTokens, compressedTokens),
  };
}

function truncateByBytes(
  input: string,
  lines: string[],
  config: ToolOutputConfig,
  originalTokens: number,
  totalBytes: number
): CompressionResult {
  const marker = generateByteTruncationMarker(totalBytes, config.maxBytes);
  const markerWithNewlines = marker + '\n';
  const markerBytes = Buffer.byteLength(markerWithNewlines, 'utf-8');

  const contentBudget = Math.max(0, config.maxBytes - markerBytes);
  const headBudget = Math.floor(contentBudget * 0.6);
  const tailBudget = contentBudget - headBudget;

  const headContent = input.slice(0, headBudget);
  const tailContent = input.slice(-tailBudget);

  let combined = markerWithNewlines + headContent;
  if (tailContent) {
    combined += '\n' + tailContent;
  }

  if (Buffer.byteLength(combined, 'utf-8') > config.maxBytes) {
    combined = combined.slice(0, config.maxBytes);
  }

  const compressedTokens = countTokens(combined);
  const ratio = estimateReduction(originalTokens, compressedTokens);

  return {
    original: input,
    compressed: combined,
    originalTokens,
    compressedTokens,
    ratio,
    method: 'truncate',
    marker: generateCompressionMarker('L1', ratio, originalTokens, compressedTokens),
  };
}

function createNoopResult(input: string): CompressionResult {
  const tokens = countTokens(input);
  return {
    original: input,
    compressed: input,
    originalTokens: tokens,
    compressedTokens: tokens,
    ratio: 0,
    method: 'none',
  };
}
