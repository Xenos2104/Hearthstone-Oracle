import type Database from 'better-sqlite3';
import { z } from 'zod';
import type { CardRow } from '../data/db.js';
import {
  escapeLike,
  excludeNonConstructedSets,
  parseJsonArray,
  toCardSummary,
} from '../data/cards.js';
import type { CardSummary } from '../format.js';

// --- Input Schema ---

export const GetKeywordInput = z.object({
  name: z.string().describe('Keyword name (e.g. "Deathrattle", "Battlecry")'),
  player_class: z
    .string()
    .optional()
    .describe('Filter related cards by class (e.g. MAGE, WARRIOR)'),
});

export type GetKeywordInputType = z.infer<typeof GetKeywordInput>;

// --- Result Types ---

export interface KeywordInfo {
  name: string;
  description: string;
  related_keywords: string[];
}

export type GetKeywordResult =
  | { found: true; keyword: KeywordInfo; cards: CardSummary[] }
  | { found: false; message: string; suggestions?: string[] };

// --- Handler ---

/** Cards are tagged with mechanics in SCREAMING_SNAKE_CASE ("BATTLECRY"). */
function toMechanicName(keyword: string): string {
  return keyword.trim().toUpperCase().replace(/\s+/g, '_');
}

export function getKeyword(
  db: Database.Database,
  input: GetKeywordInputType,
): GetKeywordResult {
  const keywordRow = db
    .prepare('SELECT * FROM keywords WHERE LOWER(name) = LOWER(?)')
    .get(input.name) as
    | { name: string; description: string; related_keywords: string | null }
    | undefined;

  const mechanicName = toMechanicName(input.name);

  let cardSql = `
    SELECT * FROM cards
    WHERE keywords LIKE ? ESCAPE '\\'
      AND collectible = 1
      AND ${excludeNonConstructedSets('cards')}
  `;
  const cardParams: unknown[] = [`%${escapeLike(mechanicName)}%`];

  if (input.player_class) {
    cardSql += ' AND UPPER(player_class) = UPPER(?)';
    cardParams.push(input.player_class);
  }

  cardSql += ' ORDER BY name LIMIT 25';

  const cards = (db.prepare(cardSql).all(...cardParams) as CardRow[]).map(
    toCardSummary,
  );

  if (keywordRow) {
    return {
      found: true,
      keyword: {
        name: keywordRow.name,
        description: keywordRow.description,
        related_keywords: parseJsonArray(keywordRow.related_keywords),
      },
      cards,
    };
  }

  // Not in the reference table, but some cards carry the mechanic.
  if (cards.length > 0) {
    return {
      found: true,
      keyword: {
        name: input.name,
        description: `Cards with the ${input.name} mechanic.`,
        related_keywords: [],
      },
      cards,
    };
  }

  const suggestions = db
    .prepare("SELECT name FROM keywords WHERE LOWER(name) LIKE LOWER(?) ESCAPE '\\' LIMIT 5")
    .all(`%${escapeLike(input.name)}%`) as Array<{ name: string }>;

  const suggestionNames = suggestions.map((s) => s.name);

  return {
    found: false,
    message: `No keyword found matching "${input.name}".`,
    suggestions: suggestionNames.length > 0 ? suggestionNames : undefined,
  };
}
