# hearthstone-oracle

MCP server for Hearthstone card data, strategy coaching, and deck analysis.

This is a **local-only** checkout: it is not published to npm, and the registry /
directory metadata used for distribution has been removed. Build and run it from
this directory (`npm install && npm run build && npm start`).

## Architecture

- **Runtime data**: Downloads HearthstoneJSON card data on first run, stores in `~/.hearthstone-oracle/`
- **Does NOT bundle card data** — data is fetched at runtime, so the first start needs network
- **Updates**: Snapshot TTL of 7 days; a stale snapshot is refreshed, a fresh one is reused
- **Storage**: SQLite via `better-sqlite3` with FTS5 full-text search
- **Two layers**: Layer 1 (card data from HearthstoneJSON) + Layer 2 (curated strategy knowledge)

## Data Source

HearthstoneJSON (hearthstonejson.com) — HearthSim community project. Unrestricted use. Auto-extracted from game files.

## Engineering

TDD workflow: write tests first, then implement.

## Important

- All logging via `console.error()` — never `console.log()` (corrupts stdio JSON-RPC)
- In-memory database for tests: `getDatabase(':memory:')`
- `npm test` (Vitest) and `npm run build` must both pass before committing

## HearthstoneJSON dbfId drift

**What it is.** dbfIds (the integer IDs encoded inside Hearthstone deckstrings) are NOT stable across HearthstoneJSON snapshots. The same logical card can be assigned a new dbfId between data drops, and old dbfIds can be reused for unrelated cards. Examples observed during the deck-decode fix session:

- Reno Jackson (`LOE_011`): `27228` → `2883` (with a Core reprint at `76314`).
- Tirion Fordring (`EX1_383`): `391` → `890`. The legacy `391` now resolves to **Perdition's Blade**, a completely different card.
- Stonetusk Boar (`CS2_171`): `604` → `648`.

**Why it happens.** This is a property of how HearthstoneJSON extracts and re-emits the card database from game files — not a bug in our pipeline. We consume the snapshot as-is.

**What we do about it.**
- Snapshot TTL: the data pipeline refreshes from HearthstoneJSON on a TTL so we converge on the latest dbfIds.
- Fallback message: `decode_deck` returns a clear placeholder for any dbfId not present in the local snapshot ("possibly added in a recent expansion; refresh data to resolve"), with the dbfId surfaced for lookup.
- Test fixtures: seed data uses dbfIds from a recent snapshot. When fixtures drift, refresh them rather than freezing on legacy IDs.

**What users should expect.** Deckstrings encoded against older Hearthstone clients may not fully decode against the current snapshot — some cards will surface as "Unknown card" with the placeholder message. That is the correct behaviour, not a bug.
