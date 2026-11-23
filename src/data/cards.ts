import type Database from 'better-sqlite3';
import type { CardRow } from './db.js';
import type { CardDetail, CardSummary } from '../format.js';

/**
 * Card sets that hold game modes (Battlegrounds, Mercenaries, Tavern Brawl) or
 * cosmetics (hero skins) rather than constructed-playable cards. They share the
 * `cards` table, so searches have to exclude them explicitly — `collectible`
 * alone does not filter hero skins.
 */
export const NON_CONSTRUCTED_SETS = [
  'HERO_SKINS',
  'BATTLEGROUNDS',
  'LETTUCE',
  'TB',
] as const;

const NON_CONSTRUCTED_SET_LIST = NON_CONSTRUCTED_SETS.map((s) => `'${s}'`).join(', ');

/** SQL predicate excluding non-constructed sets. `alias` is the table alias. */
export function excludeNonConstructedSets(alias = 'c'): string {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(${prefix}card_set, '') NOT IN (${NON_CONSTRUCTED_SET_LIST})`;
}

export function isNonConstructedSet(cardSet: string | null): boolean {
  return cardSet != null && (NON_CONSTRUCTED_SETS as readonly string[]).includes(cardSet);
}

/** Escape a value used inside a LIKE pattern (with `ESCAPE '\'`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** First line of card text, used as a compact preview. */
export function firstLine(text: string | null): string | null {
  if (!text) return null;
  const [line] = text.split('\n');
  return line ?? null;
}

export function toCardSummary(row: CardRow): CardSummary {
  return {
    name: row.name,
    mana_cost: row.mana_cost,
    type: row.type,
    player_class: row.player_class,
    rarity: row.rarity,
    text: firstLine(row.text),
    attack: row.attack,
    health: row.health,
    keywords: parseJsonArray(row.keywords),
  };
}

export function toCardDetail(row: CardRow): CardDetail {
  return {
    id: row.id,
    card_id: row.card_id,
    name: row.name,
    mana_cost: row.mana_cost,
    type: row.type,
    card_set: row.card_set,
    set_name: row.set_name,
    player_class: row.player_class,
    rarity: row.rarity,
    attack: row.attack,
    health: row.health,
    durability: row.durability,
    armor: row.armor,
    text: row.text,
    flavor: row.flavor,
    artist: row.artist,
    collectible: row.collectible,
    elite: row.elite,
    race: row.race,
    spell_school: row.spell_school,
    keywords: parseJsonArray(row.keywords),
  };
}

const ID_CHUNK_SIZE = 400;

/**
 * Fetch many cards by dbfId in a single (chunked) query.
 *
 * Replaces the per-card `db.prepare().get()` loop in the deck tools: a 30-card
 * deck used to compile and run 30 statements.
 */
export function selectCardsByIds(
  db: Database.Database,
  ids: Array<string | number>,
): Map<string, CardRow> {
  const unique = [...new Set(ids.map(String))];
  const found = new Map<string, CardRow>();

  for (let i = 0; i < unique.length; i += ID_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + ID_CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`)
      .all(...chunk) as CardRow[];

    for (const row of rows) found.set(row.id, row);
  }

  return found;
}

export const MANA_CURVE_BUCKETS = ['0', '1', '2', '3', '4', '5', '6', '7+'] as const;

export function manaCurveBucket(cost: number | null): string {
  if (cost == null) return '0';
  if (cost >= 7) return '7+';
  return String(cost);
}

/**
 * Map the `deckstrings` FormatType enum to a label.
 * 1 = Wild, 2 = Standard, 3 = Classic (verified against deckstrings@2.2.1).
 */
export function gameFormatName(format: number): string {
  switch (format) {
    case 1:
      return 'Wild';
    case 2:
      return 'Standard';
    case 3:
      return 'Classic';
    default:
      return 'Unknown';
  }
}
