export function generateLineTruncationMarker(
  hiddenLines: number,
  firstKeptLine: number,
  lastKeptLine: number
): string {
  return `[... ${hiddenLines} lines hidden (lines ${firstKeptLine}-${lastKeptLine} omitted) ...]`;
}

export function generateByteTruncationMarker(
  totalBytes: number,
  keptBytes: number
): string {
  return `[... truncated at ${keptBytes} bytes (of ${totalBytes} total) ...]`;
}

export function generateCompressionMarker(
  layer: 'L1' | 'L2' | 'L3',
  ratio: number,
  beforeTokens: number,
  afterTokens: number
): string {
  const pct = Math.round(ratio * 100);
  return `[EXTREME-COMPRESS ${layer}: ${beforeTokens}→${afterTokens} tokens (${pct}% saved) ...]`;
}
