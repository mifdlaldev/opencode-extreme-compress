import { describe, test, expect } from 'bun:test';
import { findPricing, loadPricingMap } from '../src/lib/pricing.js';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('pricing config reader', () => {
  test('loadPricingMap returns empty map if file missing', async () => {
    const m = await loadPricingMap('/nonexistent/path/config.jsonc');
    expect(m.size).toBe(0);
  });

  test('loadPricingMap parses JSONC with comments', async () => {
    const tmp = mkdtempSync(join('/tmp', 'pricing-'));
    const path = join(tmp, 'extreme-compress.jsonc');
    try {
      writeFileSync(path, `{
        // line comment
        "modelProfiles": {
          "minimax-m3": {
            "maxContextUsage": 0.95,
            "pricing": { "inputPerMTok": 0.30, "outputPerMTok": 1.20, "currency": "USD", "source": "x" }
          },
          /* block */
          "free-model": { "maxContextUsage": 0.7, "pricing": { "inputPerMTok": 0, "outputPerMTok": 0, "currency": "USD", "source": "y" } }
        }
      }`);
      const m = await loadPricingMap(path);
      expect(m.size).toBe(2);
      const m3 = m.get('minimax-m3');
      expect(m3?.inputPerMTok).toBe(0.30);
      expect(m3?.outputPerMTok).toBe(1.20);
      const free = m.get('free-model');
      expect(free?.inputPerMTok).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('findPricing is case-insensitive', () => {
    const m = new Map<string, { inputPerMTok: number; outputPerMTok: number; currency: 'USD'; source: string }>([
      ['minimax-m3', { inputPerMTok: 0.30, outputPerMTok: 1.20, currency: 'USD', source: 'x' }],
    ]);
    expect(findPricing('MiniMax-M3', m)).toBeDefined();
    expect(findPricing('MINIMAX-M3', m)).toBeDefined();
    expect(findPricing('minimax-m3', m)).toBeDefined();
    expect(findPricing('unknown', m)).toBeUndefined();
  });

  test('loadPricingMap handles malformed JSON gracefully', async () => {
    const tmp = mkdtempSync(join('/tmp', 'pricing-'));
    const path = join(tmp, 'extreme-compress.jsonc');
    try {
      writeFileSync(path, '{ not valid json');
      const m = await loadPricingMap(path);
      expect(m.size).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('loadPricingMap skips models without pricing field', async () => {
    const tmp = mkdtempSync(join('/tmp', 'pricing-'));
    const path = join(tmp, 'extreme-compress.jsonc');
    try {
      writeFileSync(path, `{
        "modelProfiles": {
          "minimax-m3": { "maxContextUsage": 0.95, "pricing": { "inputPerMTok": 0.30, "outputPerMTok": 1.20, "currency": "USD", "source": "x" } },
          "kimi-k2.6": { "maxContextUsage": 0.90 }
        }
      }`);
      const m = await loadPricingMap(path);
      expect(m.size).toBe(1);
      expect(m.has('minimax-m3')).toBe(true);
      expect(m.has('kimi-k2.6')).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
