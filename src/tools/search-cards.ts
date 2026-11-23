import type Database from 'better-sqlite3';
import { z } from 'zod';
import type { CardRow } from '../data/db.js';
import {
  escapeLike,
  excludeNonConstructedSets,
  toCardSummary,
} from '../data/cards.js';
import type { SearchCardsResult } from '../format.js';

// --- Input Schema ---

export const SearchCardsInput = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text search across card name and text (uses FTS5)'),
  player_class: z
    .string()
    .optional()
    .describe('Filter by class (e.g. MAGE, WARRIOR, NEUTRAL)'),
  mana_cost: z
    .number()
    .optional()
    .describe('Filter by mana cost (combine with cost_op for range queries)'),
  cost_op: z
    .enum(['eq', 'lt', 'lte', 'gt', 'gte'])
    .optional()
    .default('eq')
    .describe('Cost comparison operator: eq, lt, lte, gt, gte (default: eq)'),
  type: z
    .string()
    .optional()
    .describe('Filter by card type: MINION, SPELL, WEAPON, HERO, LOCATION'),
  rarity: z
    .string()
    .optional()
    .describe('Filter by rarity: FREE, COMMON, RARE, EPIC, LEGENDARY'),
  card_set: z
    .string()
    .optional()
    .describe('Filter by set code (e.g. CORE, CLASSIC, LOE)'),
  keyword: z
    .string()
    .optional()
    .describe('Filter by keyword in keywords JSON (e.g. BATTLECRY, TAUNT, CHARGE)'),
  race: z
    .string()
    .optional()
    .describe('Filter by minion race/tribe (e.g. BEAST, DRAGON, MURLOC)'),
  collectible_only: z
    .boolean()
    .optional()
    .default(true)
    .describe('Only return collectible cards (default: true)'),
  include_nonstandard: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Include Battlegrounds/Mercenaries/Tavern Brawl/hero skins (default: false)',
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(25)
    .describe('Max results to return, 1-50 (default: 25)'),
});

export type SearchCardsInputType = z.infer<typeof SearchCardsInput>;

// --- Cost operator mapping ---

const COST_OPS: Record<string, string> = {
  eq: '=',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
};

/**
 * Turn free text into a safe FTS5 query.
 *
 * FTS5 `MATCH` has its own grammar, so raw input like `C'Thun`, `*` or
 * `NEAR` either throws or silently changes meaning. Each whitespace-separated
 * token is quoted (doubling embedded quotes) and the tokens are ANDed, which
 * keeps the intuitive "all words must appear" behaviour.
 */
export function toFtsQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[+-]+/, ''))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return null;

  return tokens
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(' AND ');
}

// --- Handler ---

export function searchCards(
  db: Database.Database,
  input: SearchCardsInputType,
): SearchCardsResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (input.collectible_only !== false) {
    conditions.push('c.collectible = 1');
  }

  if (!input.include_nonstandard) {
    conditions.push(excludeNonConstructedSets('c'));
  }

  if (input.player_class) {
    conditions.push('UPPER(c.player_class) = UPPER(?)');
    params.push(input.player_class);
  }

  if (input.mana_cost != null) {
    const op = COST_OPS[input.cost_op ?? 'eq'] ?? '=';
    conditions.push(`c.mana_cost ${op} ?`);
    params.push(input.mana_cost);
  }

  if (input.type) {
    conditions.push('UPPER(c.type) = UPPER(?)');
    params.push(input.type);
  }

  if (input.rarity) {
    conditions.push('UPPER(c.rarity) = UPPER(?)');
    params.push(input.rarity);
  }

  if (input.card_set) {
    conditions.push('UPPER(c.card_set) = UPPER(?)');
    params.push(input.card_set);
  }

  if (input.keyword) {
    conditions.push("c.keywords LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(input.keyword)}%`);
  }

  if (input.race) {
    conditions.push('UPPER(c.race) = UPPER(?)');
    params.push(input.race);
  }

  const limit = input.limit ?? 25;
  const ftsQuery = input.query ? toFtsQuery(input.query) : null;

  let sql: string;
  const allParams: unknown[] = [];

  if (ftsQuery) {
    allParams.push(ftsQuery, ...params, limit);
    const whereClause =
      conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

    sql = `
      SELECT c.* FROM cards_fts
      JOIN cards c ON c.rowid = cards_fts.rowid
      WHERE cards_fts MATCH ?${whereClause}
      ORDER BY cards_fts.rank
      LIMIT ?
    `;
  } else {
    allParams.push(...params, limit);
    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    sql = `
      SELECT c.* FROM cards c
      ${whereClause}
      ORDER BY c.name
      LIMIT ?
    `;
  }

  const rows = db.prepare(sql).all(...allParams) as CardRow[];

  const cards = rows.map(toCardSummary);

  return { cards, total: cards.length };
}
