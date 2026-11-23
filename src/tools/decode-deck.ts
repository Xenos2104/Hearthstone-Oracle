import type Database from 'better-sqlite3';
import { z } from 'zod';
import { decode } from 'deckstrings';
import {
  gameFormatName,
  manaCurveBucket,
  selectCardsByIds,
  toCardSummary,
} from '../data/cards.js';
import { resolveHeroClass } from '../data/heroes.js';
import type { CardSummary } from '../format.js';

// --- Input Schema ---

export const DecodeDeckInput = z.object({
  deck_code: z.string().describe('Hearthstone deck code (base64 deckstring)'),
});

export type DecodeDeckInputType = z.infer<typeof DecodeDeckInput>;

// --- Result Types ---

export interface DecodeDeckSuccess {
  success: true;
  format: string;
  hero_class: string;
  cards: Array<{ card: CardSummary; count: number }>;
  total_cards: number;
  mana_curve: Record<string, number>;
  type_distribution: Record<string, number>;
  /** dbfIds in the deck that the local snapshot does not know about. */
  unresolved_dbf_ids: number[];
}

export interface DecodeDeckError {
  success: false;
  message: string;
}

export type DecodeDeckResult = DecodeDeckSuccess | DecodeDeckError;

// --- Handler ---

export function decodeDeck(
  db: Database.Database,
  input: DecodeDeckInputType,
): DecodeDeckResult {
  let decoded: ReturnType<typeof decode>;

  try {
    decoded = decode(input.deck_code);
  } catch (err) {
    return {
      success: false,
      message: `Invalid deck code: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const heroClass = resolveHeroClass(db, decoded.heroes[0]);
  const rowsById = selectCardsByIds(
    db,
    decoded.cards.map(([dbfId]) => dbfId),
  );

  const cards: Array<{ card: CardSummary; count: number }> = [];
  const manaCurve: Record<string, number> = {};
  const typeDistribution: Record<string, number> = {};
  const unresolved: number[] = [];
  let totalCards = 0;

  for (const [dbfId, count] of decoded.cards) {
    const row = rowsById.get(String(dbfId));

    // A miss means the deck was built on a snapshot with different dbfIds
    // (see CLAUDE.md) — keep the deck readable and report the ids separately.
    const cardSummary: CardSummary = row
      ? toCardSummary(row)
      : {
          name: `[Unknown card #${dbfId}]`,
          mana_cost: null,
          type: null,
          player_class: null,
          rarity: null,
          text: null,
          attack: null,
          health: null,
          keywords: [],
        };

    if (!row) unresolved.push(dbfId);

    cards.push({ card: cardSummary, count });
    totalCards += count;

    const bucket = manaCurveBucket(cardSummary.mana_cost);
    manaCurve[bucket] = (manaCurve[bucket] ?? 0) + count;

    const cardType = cardSummary.type ?? 'UNKNOWN';
    typeDistribution[cardType] = (typeDistribution[cardType] ?? 0) + count;
  }

  return {
    success: true,
    format: gameFormatName(decoded.format),
    hero_class: heroClass,
    cards,
    total_cards: totalCards,
    mana_curve: manaCurve,
    type_distribution: typeDistribution,
    unresolved_dbf_ids: unresolved,
  };
}
