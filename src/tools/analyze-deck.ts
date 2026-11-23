import type Database from 'better-sqlite3';
import { z } from 'zod';
import { decode } from 'deckstrings';
import {
  gameFormatName,
  manaCurveBucket,
  selectCardsByIds,
} from '../data/cards.js';
import { resolveHeroClass } from '../data/heroes.js';
import {
  classifyArchetype,
  type ClassificationResult,
  type DeckProfile,
} from '../knowledge/archetype-classifier.js';

// --- Input Schema ---

export const AnalyzeDeckInput = z.object({
  deck_code: z.string().describe('Hearthstone deck code (base64 deckstring)'),
});

export type AnalyzeDeckInputType = z.infer<typeof AnalyzeDeckInput>;

// --- Result Types ---

export interface AnalyzeDeckSuccess {
  success: true;
  deck: {
    format: string;
    hero_class: string;
    cards: Array<{ name: string; mana_cost: number | null; count: number }>;
    total_cards: number;
    mana_curve: Record<string, number>;
    type_distribution: Record<string, number>;
  };
  classification: ClassificationResult;
  archetype_info?: {
    description: string;
    gameplan: string;
    strengths: string[];
    weaknesses: string[];
  };
  matchups?: Array<{
    vs_archetype: string;
    favoured: string;
    key_tension: string;
  }>;
  /** dbfIds in the deck that the local snapshot does not know about. */
  unresolved_dbf_ids: number[];
}

export interface AnalyzeDeckError {
  success: false;
  message: string;
}

export type AnalyzeDeckResult = AnalyzeDeckSuccess | AnalyzeDeckError;

// --- Strategy lookups ---

interface ArchetypeRow {
  name: string;
  description: string;
  gameplan: string;
  strengths: string;
  weaknesses: string;
}

interface MatchupRow {
  archetype_a: string;
  archetype_b: string;
  favoured: string;
  key_tension: string;
}

function parseJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Matchups against the classified archetype.
 *
 * The table stores some pairs in both directions and also contains self-pairs
 * (aggro vs aggro); both are dropped here so the output lists each opponent once.
 */
function findMatchups(
  db: Database.Database,
  archetype: string,
): NonNullable<AnalyzeDeckSuccess['matchups']> {
  const target = archetype.toLowerCase();

  const rows = db
    .prepare(
      `SELECT archetype_a, archetype_b, favoured, key_tension FROM matchup_framework
       WHERE LOWER(archetype_a) = LOWER(?) OR LOWER(archetype_b) = LOWER(?)`,
    )
    .all(archetype, archetype) as MatchupRow[];

  const seen = new Set<string>();
  const matchups: NonNullable<AnalyzeDeckSuccess['matchups']> = [];

  for (const row of rows) {
    const a = row.archetype_a.toLowerCase();
    const b = row.archetype_b.toLowerCase();

    if (a === b) continue; // self-pair

    const opponent = a === target ? row.archetype_b : row.archetype_a;
    const key = opponent.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    matchups.push({
      vs_archetype: opponent,
      favoured: row.favoured,
      key_tension: row.key_tension,
    });
  }

  matchups.sort((x, y) => x.vs_archetype.localeCompare(y.vs_archetype));
  return matchups;
}

// --- Handler ---

export function analyzeDeck(
  db: Database.Database,
  input: AnalyzeDeckInputType,
): AnalyzeDeckResult {
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

  const deckCards: Array<{
    name: string;
    mana_cost: number | null;
    count: number;
  }> = [];
  const profileCards: DeckProfile['cards'] = [];
  const manaCurve: Record<string, number> = {};
  const typeDistribution: Record<string, number> = {};
  const unresolved: number[] = [];
  let totalCards = 0;
  let totalCost = 0;
  let cardsWithCost = 0;

  for (const [dbfId, count] of decoded.cards) {
    const row = rowsById.get(String(dbfId));
    if (!row) unresolved.push(dbfId);

    const name = row?.name ?? `[Unknown card #${dbfId}]`;
    const manaCost = row?.mana_cost ?? null;
    const type = row?.type ?? null;
    const text = row?.text ?? null;
    const keywords = row?.keywords ?? null;

    deckCards.push({ name, mana_cost: manaCost, count });

    for (let i = 0; i < count; i++) {
      profileCards.push({ mana_cost: manaCost, type, text, keywords });
    }

    totalCards += count;

    const bucket = manaCurveBucket(manaCost);
    manaCurve[bucket] = (manaCurve[bucket] ?? 0) + count;

    const cardType = type ?? 'UNKNOWN';
    typeDistribution[cardType] = (typeDistribution[cardType] ?? 0) + count;

    if (manaCost != null) {
      totalCost += manaCost * count;
      cardsWithCost += count;
    }
  }

  const profile: DeckProfile = {
    avg_cost: cardsWithCost > 0 ? totalCost / cardsWithCost : 0,
    cards: profileCards,
    total_cards: totalCards,
    mana_curve: manaCurve,
    type_distribution: typeDistribution,
  };

  const classification = classifyArchetype(profile);

  const archetypeRow = db
    .prepare('SELECT * FROM archetypes WHERE LOWER(name) = LOWER(?)')
    .get(classification.archetype) as ArchetypeRow | undefined;

  const archetypeInfo = archetypeRow
    ? {
        description: archetypeRow.description,
        gameplan: archetypeRow.gameplan,
        strengths: parseJson(archetypeRow.strengths),
        weaknesses: parseJson(archetypeRow.weaknesses),
      }
    : undefined;

  const matchups = findMatchups(db, classification.archetype);

  return {
    success: true,
    deck: {
      format: gameFormatName(decoded.format),
      hero_class: heroClass,
      cards: deckCards,
      total_cards: totalCards,
      mana_curve: manaCurve,
      type_distribution: typeDistribution,
    },
    classification,
    archetype_info: archetypeInfo,
    matchups: matchups.length > 0 ? matchups : undefined,
    unresolved_dbf_ids: unresolved,
  };
}
