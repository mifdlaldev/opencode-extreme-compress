import { describe, test, expect } from 'bun:test';
import {
  generateLineTruncationMarker,
  generateByteTruncationMarker,
  generateCompressionMarker,
} from '../src/utils/marker';

describe('marker generator', () => {
  test('generateLineTruncationMarker includes line counts', () => {
    const marker = generateLineTruncationMarker(800, 200, 7000);
    expect(marker).toContain('800');
    expect(marker).toContain('200');
    expect(marker).toContain('7000');
    expect(marker).toContain('lines');
  });

  test('generateByteTruncationMarker includes byte counts', () => {
    const marker = generateByteTruncationMarker(102400, 5000);
    expect(marker).toContain('102400');
    expect(marker).toContain('5000');
    expect(marker).toContain('bytes');
  });

  test('generateCompressionMarker includes layer and ratio', () => {
    const marker = generateCompressionMarker('L1', 0.76, 5000, 1200);
    expect(marker).toContain('L1');
    expect(marker).toContain('76'); // percentage
    expect(marker).toContain('5000');
    expect(marker).toContain('1200');
    expect(marker).toContain('saved');
  });

  test('generateCompressionMarker rounds percentage correctly', () => {
    expect(generateCompressionMarker('L2', 0.756, 1000, 244)).toContain('76'); // 75.6% → 76%
    expect(generateCompressionMarker('L2', 0.123, 1000, 877)).toContain('12'); // 12.3% → 12%
  });

  test('markers have consistent prefix for grep-ability', () => {
    const m1 = generateLineTruncationMarker(100, 50, 1000);
    const m2 = generateByteTruncationMarker(1024, 500);
    const m3 = generateCompressionMarker('L3', 0.5, 1000, 500);
    // All should contain '...' to indicate truncation
    expect(m1).toContain('...');
    expect(m2).toContain('...');
    expect(m3).toContain('...');
  });
});
