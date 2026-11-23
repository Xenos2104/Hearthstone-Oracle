import { describe, it, expect } from 'vitest';
import { formatManaCurve } from '../src/format.js';

describe('formatManaCurve', () => {
  it('normalises bars to at most 20 columns', () => {
    const lines = formatManaCurve({ '2': 12, '4': 3, '7+': 1 });
    expect(lines).toHaveLength(3);

    for (const line of lines) {
      const match = /^(\d\+?): (█+) (\d+)$/.exec(line);
      expect(match).not.toBeNull();
      expect(match![2]!.length).toBeLessThanOrEqual(20);
    }

    // The tallest bucket takes the full width
    expect(lines[0]).toMatch(/^2: █{20} 12$/);
  });

  it('scales smaller buckets proportionally', () => {
    const lines = formatManaCurve({ '1': 1, '3': 4 });
    expect(lines[0]).toBe(`1: ${'█'.repeat(5)} 1`);
    expect(lines[1]).toBe(`3: ${'█'.repeat(20)} 4`);
  });

  it('keeps at least one block for a tiny bucket', () => {
    const [line] = formatManaCurve({ '1': 1, '7+': 100 });
    expect(line).toBe('1: █ 1');
  });

  it('skips empty buckets', () => {
    expect(formatManaCurve({})).toEqual([]);
    expect(formatManaCurve({ '3': 2 })).toHaveLength(1);
  });
});
