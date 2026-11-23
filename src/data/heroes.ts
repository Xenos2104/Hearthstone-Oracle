import type Database from 'better-sqlite3';

/**
 * Fallback map from hero dbfId to class, used when the hero card itself is not
 * in the local snapshot (or resolves to a class-less row).
 *
 * Shared by decode_deck and analyze_deck — previously copy-pasted in both.
 */
export const HERO_CLASS_BY_DBF_ID: Readonly<Record<number, string>> = {
  7: 'WARRIOR', // Garrosh Hellscream
  274: 'MAGE', // Jaina Proudmoore
  31: 'HUNTER', // Rexxar
  637: 'PRIEST', // Anduin Wrynn
  930: 'ROGUE', // Valeera Sanguinar
  1066: 'PALADIN', // Uther Lightbringer
  671: 'WARLOCK', // Gul'dan
  813: 'SHAMAN', // Thrall
  893: 'DRUID', // Malfurion Stormrage
  56550: 'DEMON_HUNTER', // Illidan Stormrage
  78065: 'DEATH_KNIGHT', // The Lich King
};

/** Resolve a deck's hero class from its hero dbfId (DB first, then the map). */
export function resolveHeroClass(
  db: Database.Database,
  heroDbfId: number | undefined,
): string {
  if (heroDbfId == null) return 'UNKNOWN';

  const row = db
    .prepare('SELECT player_class FROM cards WHERE id = ?')
    .get(String(heroDbfId)) as { player_class: string | null } | undefined;

  return row?.player_class ?? HERO_CLASS_BY_DBF_ID[heroDbfId] ?? 'UNKNOWN';
}
