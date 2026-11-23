import { describe, it, expect } from 'vitest';
import {
  NON_CONSTRUCTED_SETS,
  escapeLike,
  excludeNonConstructedSets,
  gameFormatName,
  manaCurveBucket,
} from '../../src/data/cards.js';
import { toFtsQuery } from '../../src/tools/search-cards.js';

describe('toFtsQuery', () => {
  it('quotes a single token', () => {
    expect(toFtsQuery('Fireball')).toBe('"Fireball"');
  });

  it('quotes embedded apostrophes instead of breaking the MATCH grammar', () => {
    expect(toFtsQuery("C'Thun")).toBe(`"C'Thun"`);
  });

  it('ANDS whitespace-separated tokens', () => {
    expect(toFtsQuery('Reno Jackson')).toBe('"Reno" AND "Jackson"');
  });

  it('strips leading +/- so they cannot become operators', () => {
    expect(toFtsQuery('Reno -Jackson')).toBe('"Reno" AND "Jackson"');
  });

  it('doubles embedded double quotes', () => {
    expect(toFtsQuery('a"b')).toBe('"a""b"');
  });

  it('returns null for blank input', () => {
    expect(toFtsQuery('   ')).toBeNull();
  });
});

describe('non-constructed set filtering', () => {
  it('lists every excluded set in the SQL predicate', () => {
    const clause = excludeNonConstructedSets('c');
    for (const set of NON_CONSTRUCTED_SETS) {
      expect(clause).toContain(`'${set}'`);
    }
    expect(clause).toContain('c.card_set');
  });

  it('supports an alias-less predicate', () => {
    expect(excludeNonConstructedSets('')).toContain('COALESCE(card_set,');
  });
});

describe('helpers', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });

  it('maps mana costs to curve buckets', () => {
    expect(manaCurveBucket(null)).toBe('0');
    expect(manaCurveBucket(0)).toBe('0');
    expect(manaCurveBucket(6)).toBe('6');
    expect(manaCurveBucket(9)).toBe('7+');
  });

  it('maps deckstrings formats (1 Wild, 2 Standard, 3 Classic)', () => {
    expect(gameFormatName(1)).toBe('Wild');
    expect(gameFormatName(2)).toBe('Standard');
    expect(gameFormatName(3)).toBe('Classic');
    expect(gameFormatName(0)).toBe('Unknown');
  });
});
