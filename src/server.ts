#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRequire } from 'node:module';
import type Database from 'better-sqlite3';
import type { z } from 'zod';

import { SearchCardsInput, searchCards } from './tools/search-cards.js';
import { GetCardInput, getCard } from './tools/get-card.js';
import { GetKeywordInput, getKeyword } from './tools/get-keyword.js';
import { DecodeDeckInput, decodeDeck } from './tools/decode-deck.js';
import { AnalyzeDeckInput, analyzeDeck } from './tools/analyze-deck.js';
import { GetArchetypeInput, getArchetype } from './tools/get-archetype.js';
import {
  GetClassIdentityInput,
  getClassIdentity,
} from './tools/get-class-identity.js';
import { GetMatchupInput, getMatchup } from './tools/get-matchup.js';
import { ExplainConceptInput, explainConcept } from './tools/explain-concept.js';

import {
  formatSearchCards,
  formatGetCard,
  formatGetKeyword,
  formatDecodeDeck,
  formatAnalyzeDeck,
  formatGetArchetype,
  formatGetClassIdentity,
  formatGetMatchup,
  formatExplainConcept,
} from './format.js';

import { getDatabase } from './data/db.js';
import { runPipeline } from './data/pipeline.js';
import { seedStrategyKnowledge } from './data/strategy-seed.js';

// --- Tool plumbing ---

type ToolHandler = (db: Database.Database, params: never) => unknown;

interface ToolSpec {
  name: string;
  description: string;
  shape: z.ZodRawShape;
  handler: ToolHandler;
  format: (result: never) => string;
}

/**
 * Register one MCP tool.
 *
 * Every tool has the same lifecycle: run the handler against the database,
 * format the result as text, and turn any thrown error into an `isError`
 * response instead of crashing the server. Keeping that in one place is why
 * this file is short — it used to repeat the try/catch block nine times.
 */
function registerTool(
  server: McpServer,
  db: Database.Database,
  spec: ToolSpec,
): void {
  server.tool(spec.name, spec.description, spec.shape, async (params) => {
    try {
      const result = spec.handler(db, params as never);
      return {
        content: [{ type: 'text' as const, text: spec.format(result as never) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}

const TOOLS: ToolSpec[] = [
  {
    name: 'search_cards',
    description:
      'Search for Hearthstone cards by name, text, class, mana cost, type, rarity, set, or keyword. Use this when you need to find cards matching specific criteria. Returns a summary list — use get_card for full details on a specific card.',
    shape: SearchCardsInput.shape,
    handler: searchCards,
    format: formatSearchCards,
  },
  {
    name: 'get_card',
    description:
      'Get complete details for a specific Hearthstone card including stats, text, keywords, and type. Use this when you know the card name (or close to it) and need full information. Supports fuzzy matching.',
    shape: GetCardInput.shape,
    handler: getCard,
    format: formatGetCard,
  },
  {
    name: 'get_keyword',
    description:
      'Look up a Hearthstone keyword or mechanic (e.g., Battlecry, Deathrattle, Discover) and see all cards that have it. Use this to explain what a keyword does or find all cards with a specific mechanic.',
    shape: GetKeywordInput.shape,
    handler: getKeyword,
    format: formatGetKeyword,
  },
  {
    name: 'decode_deck',
    description:
      "Decode a Hearthstone deck code into its full card list with mana curve and card type breakdown. Use this when a user shares a deck code and wants to see what's in it.",
    shape: DecodeDeckInput.shape,
    handler: decodeDeck,
    format: formatDecodeDeck,
  },
  {
    name: 'analyze_deck',
    description:
      'Analyze a Hearthstone deck code to classify its archetype, explain its gameplan, identify strengths and weaknesses, and predict matchup dynamics. Use this for strategic deck coaching — it combines card data with strategy knowledge.',
    shape: AnalyzeDeckInput.shape,
    handler: analyzeDeck,
    format: formatAnalyzeDeck,
  },
  {
    name: 'get_archetype',
    description:
      'Get a detailed explanation of a Hearthstone deck archetype (aggro, control, combo, midrange, tempo, value). Includes gameplan, win conditions, strengths, weaknesses, and example decks. Use this when explaining deck building strategy.',
    shape: GetArchetypeInput.shape,
    handler: getArchetype,
    format: formatGetArchetype,
  },
  {
    name: 'get_class_identity',
    description:
      'Get the strategic identity of a Hearthstone class — hero power implications, historical archetypes, strengths, weaknesses, and how the class approaches each game phase. Omit the class name to get an overview of all 11 classes.',
    shape: GetClassIdentityInput.shape,
    handler: getClassIdentity,
    format: formatGetClassIdentity,
  },
  {
    name: 'get_matchup',
    description:
      'Get the theoretical matchup dynamics between two Hearthstone archetypes. Explains who is favoured, why, the key strategic tension, and what each side should prioritise.',
    shape: GetMatchupInput.shape,
    handler: getMatchup,
    format: formatGetMatchup,
  },
  {
    name: 'explain_concept',
    description:
      'Explain a fundamental Hearthstone game concept like card advantage, tempo, value, board control, or mana curve. Includes how the concept applies specifically to Hearthstone.',
    shape: ExplainConceptInput.shape,
    handler: explainConcept,
    format: formatExplainConcept,
  },
];

// --- Server ---

function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export function createServer(db: Database.Database): McpServer {
  const server = new McpServer(
    { name: 'hearthstone-oracle', version: getVersion() },
    { capabilities: { tools: {} } },
  );

  for (const spec of TOOLS) registerTool(server, db, spec);

  return server;
}

async function main(): Promise<void> {
  const version = getVersion();
  const db = getDatabase();

  const forceRefresh = process.env.HEARTHSTONE_ORACLE_FORCE_REFRESH === '1';

  try {
    console.error('[hearthstone-oracle] Starting data pipeline...');
    const cardCount = await runPipeline(db, { force: forceRefresh });
    console.error(`[hearthstone-oracle] Pipeline: ok (${cardCount} cards)`);
  } catch (err) {
    console.error(
      `[hearthstone-oracle] Pipeline error: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error(
      '[hearthstone-oracle] Continuing with existing data (if any)...',
    );
  }

  seedStrategyKnowledge(db);

  const server = createServer(db);
  await server.connect(new StdioServerTransport());
  console.error(`[hearthstone-oracle] v${version} running on stdio — 9 tools`);

  const shutdown = async (): Promise<void> => {
    try {
      await server.close();
    } finally {
      db.close();
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(
    `[hearthstone-oracle] Fatal: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
