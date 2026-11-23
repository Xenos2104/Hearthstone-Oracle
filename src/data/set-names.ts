/**
 * Human-readable names for HearthstoneJSON set codes.
 *
 * HearthstoneJSON exposes only the short code (`set`), never a display name, so
 * the mapping has to live here. Codes missing from the map fall back to a
 * de-coded label ("TIME_TRAVEL" → "Time Travel") rather than being invented.
 */
const SET_NAMES: Readonly<Record<string, string>> = {
  BASIC: 'Basic',
  EXPERT1: 'Classic',
  LEGACY: 'Legacy',
  VANILLA: 'Vanilla',
  CORE: 'Core',
  CORE_HIDDEN: 'Core (hidden)',
  NAXX: 'Curse of Naxxramas',
  GVG: 'Goblins vs Gnomes',
  BRM: 'Blackrock Mountain',
  TGT: 'The Grand Tournament',
  LOE: 'The League of Explorers',
  OG: 'Whispers of the Old Gods',
  KARA: 'One Night in Karazhan',
  GANGS: 'Mean Streets of Gadgetzan',
  UNGORO: "Journey to Un'Goro",
  ICECROWN: 'Knights of the Frozen Throne',
  LOOTAPALOOZA: 'Kobolds & Catacombs',
  GILNEAS: 'The Witchwood',
  BOOMSDAY: 'The Boomsday Project',
  TROLL: "Rastakhan's Rumble",
  DALARAN: 'Rise of Shadows',
  ULDUM: 'Saviors of Uldum',
  DRAGONS: 'Descent of Dragons',
  YEAR_OF_THE_DRAGON: 'Year of the Dragon',
  BLACK_TEMPLE: 'Ashes of Outland',
  SCHOLOMANCE: 'Scholomance Academy',
  DARKMOON_FAIRE: 'Madness at the Darkmoon Faire',
  THE_BARRENS: 'Forged in the Barrens',
  STORMWIND: 'United in Stormwind',
  ALTERAC_VALLEY: 'Fractured in Alterac Valley',
  THE_SUNKEN_CITY: 'Voyage to the Sunken City',
  REVENDRETH: 'Murder at Castle Nathria',
  PATH_OF_ARTHAS: 'March of the Lich King',
  TITANS: 'TITANS',
  WILD_WEST: 'Showdown in the Badlands',
  BATTLE_OF_THE_BANDS: 'Festival of Legends',
  WHIZBANGS_WORKSHOP: "Whizbang's Workshop",
  ISLAND_VACATION: 'Perils in Paradise',
  SPACE: 'The Great Dark Beyond',
  THE_LOST_CITY: "The Lost City of Un'Goro",
  EMERALD_DREAM: 'Into the Emerald Dream',
  TAVERNS_OF_TIME: 'Taverns of Time',
  DEMON_HUNTER_INITIATE: 'Demon Hunter Initiate',
  // Game modes / non-constructed content that shares the cards table
  BATTLEGROUNDS: 'Battlegrounds',
  LETTUCE: 'Mercenaries',
  TB: 'Tavern Brawl',
  HERO_SKINS: 'Hero Skins',
  MISSIONS: 'Missions',
  TUTORIAL: 'Tutorial',
  CREDITS: 'Credits',
  PET: 'Pets',
  EVENT: 'Event',
};

/** Turn an unmapped code into a readable label without inventing a set name. */
function prettifySetCode(code: string): string {
  if (!code.includes('_') && code.length <= 4) return code;
  return code
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function displaySetName(cardSet: string | null): string | null {
  if (!cardSet) return null;
  return SET_NAMES[cardSet] ?? prettifySetCode(cardSet);
}
