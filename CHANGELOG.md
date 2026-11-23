# Changelog

All notable changes to hearthstone-oracle will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0

First release of the `@xenos2104/hearthstone-oracle` fork.

### Fixed
- **`search_cards` crashed on FTS5 syntax.** User text went straight into
  `MATCH`, so `C'Thun`, `*`, `NEAR` or a stray `-` raised `fts5: syntax error`.
  Tokens are now quoted and ANDed (`escapeFtsQuery`/`toFtsQuery`).
- **`get_card` returned an arbitrary printing.** A name maps to many rows
  (reprints, hero skins, Battlegrounds). Queries now order by
  `collectible DESC`, then constructed sets before skins/Battlegrounds, then
  highest dbfId, and require `collectible = 1` for fuzzy matches.
- **`analyze_deck` never filtered matchups.** The predicate used `||` between
  two inequalities, so self-pairs (`aggro vs aggro`) and duplicate directions
  leaked into the output. Now self-pairs are dropped, opponents de-duplicated
  and sorted.
- **Non-constructed cards polluted searches.** `collectible = 1` does not
  exclude the 790 collectible hero skins. `search_cards`/`get_keyword` now
  exclude `HERO_SKINS`, `BATTLEGROUNDS`, `LETTUCE` and `TB` by default;
  `search_cards` gained `include_nonstandard` to opt back in.
- **Classic decks were labelled Standard.** `deckstrings` reports
  `1 = Wild, 2 = Standard, 3 = Classic`; the old check mapped everything but 1
  to Standard.
- **Mana curve bars overflowed the output** (`'#'.repeat(count)`, up to 30+
  characters). Curves are normalised to a 20-column width and use one bar
  character in both deck tools.
- **Unknown dbfIds printed a sentence per card.** The placeholder is now
  `[Unknown card #dbfId]` and unresolved ids are reported once at the end of
  the output.
- **`set_name` was always null**, so users saw raw codes (`BE`,
  `CORE_HIDDEN`). Set codes now resolve to display names, with a readable
  fallback for codes without a known name.

### Changed
- **`server.ts` shrunk from 352 to ~250 lines**: one `registerTool` helper
  replaces nine copies of the same try/catch/formatter block.
- **Deck tools batch-load cards** with a single `WHERE id IN (...)` query
  instead of compiling one statement per card.
- **Shared helpers** (`src/data/cards.ts`, `src/data/heroes.ts`,
  `src/data/set-names.ts`) replace copy-pasted conversions, the duplicated
  hero map, and per-file JSON parsing.
- **Expression indexes** (`LOWER(name)`, `UPPER(player_class)`, …) so the
  case-insensitive predicates can actually use an index; the unused `sets`
  table was dropped.
- **`HEARTHSTONE_ORACLE_DATA_DIR`** isolates the database and the
  `last_update.json` timestamp; **`HEARTHSTONE_ORACLE_FORCE_REFRESH=1`** forces
  a snapshot refresh. SIGINT/SIGTERM now close the database (WAL files no
  longer linger).

## Local-only fork

### Changed
- **Local-only conversion.** Dropped the npm/registry distribution surface: removed
  `glama.json`, `server.json`, `status.json`, the MCP QA report directory, and the
  GitHub CI/funding workflows. `package.json` is now `private`, with `files`,
  `prepublishOnly`, and `mcpName` removed.
- **Cross-platform build.** `npm run build` no longer shells out to `cp`/`chmod`;
  the asset copy and exec-bit step now live in `scripts/copy-assets.mjs` so the
  build works on Windows.

### Unchanged
- Card data is still fetched online from HearthstoneJSON at startup, cached in
  `~/.hearthstone-oracle/cards.sqlite`, and refreshed on a 7-day TTL.

## 0.1.1

### Fixed
- **Data freshness:** `decode_deck` was returning "Unknown Card" placeholders for valid
  deckstrings because cached HearthstoneJSON snapshots went stale silently. The pipeline
  now refreshes when the local snapshot is older than 7 days (TTL via `isStale()`), and
  the on-disk `last_update.json` timestamp is honoured rather than just written.
- **Fallback message:** unknown dbfIds in `decode_deck` output now surface a clearer
  placeholder — naming the dbfId, flagging the likely cause (recent expansion), and
  pointing the user at a data refresh — instead of a bare "Unknown Card (12345)".

### Changed
- **Test fixtures:** refreshed legacy dbfIds to match the current HearthstoneJSON snapshot
  (Reno Jackson `27228 → 2883`, Tirion Fordring `391 → 890`, Stonetusk Boar `604 → 648`).
  Fireball (`315`) and Fiery War Axe (`401`) remained stable. The legacy Tirion id `391`
  now resolves to Perdition's Blade — a real example of dbfId drift.

### Documented
- **CLAUDE.md:** captured the HearthstoneJSON dbfId-drift gotcha — what it is, why it
  happens, what the pipeline already does about it (TTL refresh + decode_deck fallback),
  and what users should expect from older deckstrings. Future bug triage starts here.

### Tests
- Added `isStale()` boundary tests (no timestamp, unparseable, fresh, stale, custom
  threshold) and decode_deck fallback message tests. Total: 117 passing (was 111).

## 0.1.0

- Initial release.
