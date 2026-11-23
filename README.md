# hearthstone-oracle

Hearthstone MCP server with card search, deck analysis, and strategy coaching. Gives LLMs access to the full Hearthstone card pool plus built-in strategy knowledge for deck building and gameplay advice.

This is a **local-only fork** of `gregario/hearthstone-oracle`. It is not published to npm and carries no MCP registry / directory metadata — you build it and run it from this directory. Card data is still fetched online from HearthstoneJSON at runtime.

## Requirements

- Node.js 18+ (tested on Node 24; `.nvmrc` pins 20)
- Network access on first run (card data download); no API key

## Setup

```bash
npm install
npm run build
npm start
```

`npm start` launches the server on stdio — it is a long-running process, not a CLI. It is meant to be spawned by an MCP client, not typed into a terminal. For a first check, see the smoke test below.

## Registering with an MCP client

The server speaks stdio JSON-RPC, so a client needs the absolute path to `node` and to `dist/server.js`.

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hearthstone-oracle": {
      "command": "node",
      "args": ["C:\\path\\to\\hearthstone-oracle\\dist\\server.js"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add hearthstone-oracle -- node "$(pwd)/dist/server.js"
```

Keep stdout clean: all diagnostic logging goes to stderr (required, since stdout carries JSON-RPC frames).

## Tools

| Tool | Description |
|------|-------------|
| `search_cards` | Search cards by name, text, class, cost, type, rarity, set, or keyword |
| `get_card` | Get complete details for a specific card with fuzzy matching |
| `get_keyword` | Look up keyword/mechanic definitions with related cards |
| `decode_deck` | Decode a deck code into full card list with mana curve |
| `analyze_deck` | Analyze a deck's archetype, gameplan, strengths, and matchup profile |
| `get_archetype` | Learn about deck archetypes (aggro, control, combo, midrange, tempo, value) |
| `get_class_identity` | Strategic identity of each Hearthstone class |
| `get_matchup` | Theoretical matchup dynamics between archetypes |
| `explain_concept` | Fundamental game concepts explained for Hearthstone |

## How it works

Two layers:

1. **Card data** — the full card database from HearthstoneJSON, cached in a local SQLite file with FTS5 full-text search. On startup the server downloads the snapshot, stores it in `~/.hearthstone-oracle/cards.sqlite`, and skips the download while the snapshot is younger than 7 days. If a refresh fails, the server keeps serving the cached data.
2. **Strategy knowledge** — curated strategy content (archetypes, class identities, matchup theory, core concepts) seeded into the same database on every start. This is what makes the server a coach rather than a card dump.

Source layout:

```
src/server.ts            MCP entry point — registers the 9 tools, runs the pipeline
src/data/db.ts           SQLite open + schema init
src/data/schema.sql      Tables, FTS5 index, triggers
src/data/hearthstone.ts  HearthstoneJSON fetch + transform + ingest
src/data/pipeline.ts     7-day TTL refresh, graceful degradation
src/data/strategy-seed.ts Layer-2 strategy knowledge
src/knowledge/           Rule-based archetype classifier
src/tools/               One file per MCP tool
src/format.ts            Tool output formatting
tests/                   Vitest suite (in-memory SQLite)
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HEARTHSTONE_ORACLE_DATA_DIR` | `~/.hearthstone-oracle` | Where the SQLite database and `last_update.json` live. Point several checkouts at different directories to keep them isolated. |
| `HEARTHSTONE_ORACLE_FORCE_REFRESH` | unset | Set to `1` to re-download the card snapshot on startup, ignoring the 7-day TTL. |

## Tests

```bash
npm test          # single run
npm run test:watch
```

The suite uses in-memory databases (`getDatabase(':memory:')`) and never touches the network or `~/.hearthstone-oracle`.

## Data

Card data provided by [HearthstoneJSON](https://hearthstonejson.com) by [HearthSim](https://hearthsim.info), auto-extracted from game files, unrestricted use.

Note: dbfIds are not stable across HearthstoneJSON snapshots, so deck codes crafted against older clients may show a few cards as "Unknown card" until the local snapshot refreshes. See `CLAUDE.md` for the full explanation.

## License

MIT
