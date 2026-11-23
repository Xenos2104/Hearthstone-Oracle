import type Database from 'better-sqlite3';
import { z } from 'zod';
import type { CardRow } from '../data/db.js';
import {
  escapeLike,
  excludeNonConstructedSets,
  toCardDetail,
} from '../data/cards.js';
import type { GetCardResult } from '../format.js';

// --- Input Schema ---

export const GetCardInput = z.object({
  name: z.string().describe('Card name to look up (exact or partial match)'),
});

export type GetCardInputType = z.infer<typeof GetCardInput>;

/*
 * A card name maps to several rows: every reprint (Classic / Core / Wild
 * versions) carries its own dbfId, and non-constructed sets reuse the same
 * names. Without an explicit order SQLite returns whichever row happens to be
 * first, which is why lookups used to hand back stale stats.
 *
 * Preference order: collectible first, constructed sets before skins /
 * Battlegrounds, then the highest dbfId (the most recently printed version).
 */
const EXACT_MATCH_SQL = `
  SELECT * FROM cards
  WHERE LOWER(name) = LOWER(?)
  ORDER BY collectible DESC,
           CASE WHEN ${excludeNonConstructedSets('')} THEN 0 ELSE 1 END,
           CAST(id AS INTEGER) DESC
  LIMIT 1
`;

const FUZZY_MATCH_SQL = `
  SELECT * FROM cards
  WHERE LOWER(name) LIKE LOWER(?) ESCAPE '\\'
    AND collectible = 1
    AND ${excludeNonConstructedSets('')}
  ORDER BY LENGTH(name), CAST(id AS INTEGER) DESC
  LIMIT 1
`;

const SUGGESTIONS_SQL = `
  SELECT DISTINCT name FROM cards
  WHERE LOWER(name) LIKE LOWER(?) ESCAPE '\\'
    AND collectible = 1
    AND ${excludeNonConstructedSets('')}
  ORDER BY LENGTH(name)
  LIMIT 5
`;

// --- Handler ---

export function getCard(
  db: Database.Database,
  input: GetCardInputType,
): GetCardResult {
  const exact = db.prepare(EXACT_MATCH_SQL).get(input.name) as
    | CardRow
    | undefined;

  if (exact) {
    return { found: true, card: toCardDetail(exact) };
  }

  const fuzzy = db
    .prepare(FUZZY_MATCH_SQL)
    .get(`%${escapeLike(input.name)}%`) as CardRow | undefined;

  if (fuzzy) {
    return { found: true, card: toCardDetail(fuzzy) };
  }

  // Not found — suggest cards sharing the first word of the query.
  const firstWord = input.name.trim().split(/\s+/)[0] ?? input.name;
  const suggestions = db
    .prepare(SUGGESTIONS_SQL)
    .all(`%${escapeLike(firstWord)}%`) as Array<{ name: string }>;

  const suggestionNames = suggestions.map((s) => s.name);

  return {
    found: false,
    message: `No card found matching "${input.name}".`,
    suggestions: suggestionNames.length > 0 ? suggestionNames : undefined,
  };
}
