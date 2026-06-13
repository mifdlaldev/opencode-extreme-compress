/**
 * Token counter using chars/4 approximation.
 *
 * Why chars/4: GPT-2/BPE tokenizers average ~4 chars per token for English.
 * This is approximate (~80% accurate) but doesn't require loading a tokenizer.
 * We always CEIL to avoid underestimation (safer for compression decisions).
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateReduction(originalTokens: number, compressedTokens: number): number {
  if (originalTokens === 0) return 0;
  return (originalTokens - compressedTokens) / originalTokens;
}

export function bytesToApproxTokens(bytes: number): number {
  return Math.ceil(bytes / 4);
}
