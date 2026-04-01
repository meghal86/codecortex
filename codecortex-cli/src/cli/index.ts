#!/usr/bin/env node

// Heap re-spawn removed — only analyze.ts needs the 8GB heap (via its own ensureHeap()).
// Removing it from here improves MCP server startup time significantly.

import { Command } from 'commander';
import { analyzeCommand } from './analyze.js';
import { serveCommand } from './serve.js';
import { listCommand } from './list.js';
import { statusCommand } from './status.js';
import { mcpCommand } from './mcp.js';
import { cleanCommand } from './clean.js';
import { setupCommand } from './setup.js';
import { augmentCommand } from './augment.js';
import { wikiCommand } from './wiki.js';
import { queryCommand, contextCommand, impactCommand, cypherCommand, detectImpactCommand } from './tool.js';
import { diagramCommand } from './diagram.js';
import { finopsCommand } from './finops.js';
import { evalServerCommand } from './eval-server.js';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const pkg = _require('../../package.json');
const program = new Command();

program
  .name('codecortex')
  .description('CodeCortex local CLI and MCP server')
  .version(pkg.version);

program
  .command('setup')
  .description('One-time setup: configure MCP for Cursor, Claude Code, OpenCode')
  .action(setupCommand);

program
  .command('analyze [path]')
  .description('Index a repository (full analysis)')
  .option('-f, --force', 'Force full re-index even if up to date')
  .option('--embeddings', 'Enable embedding generation for semantic search (off by default)')
  .action(analyzeCommand);

program
  .command('serve')
  .description('Start local HTTP server for web UI connection')
  .option('-p, --port <port>', 'Port number', '4747')
  .option('--host <host>', 'Bind address (default: 127.0.0.1, use 0.0.0.0 for remote access)')
  .action(serveCommand);

program
  .command('mcp')
  .description('Start MCP server (stdio) — serves all indexed repos')
  .action(mcpCommand);

program
  .command('list')
  .description('List all indexed repositories')
  .action(listCommand);

program
  .command('status')
  .description('Show index status for current repo')
  .action(statusCommand);

program
  .command('clean')
  .description('Delete CodeCortex index for current repo')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--all', 'Clean all indexed repos')
  .action(cleanCommand);

program
  .command('wiki [path]')
  .description('Generate repository wiki from knowledge graph')
  .option('-f, --force', 'Force full regeneration even if up to date')
  .option('--model <model>', 'LLM model name (default: minimax/minimax-m2.5)')
  .option('--base-url <url>', 'LLM API base URL (default: OpenAI)')
  .option('--api-key <key>', 'LLM API key (saved to ~/.codecortex/config.json)')
  .option('--concurrency <n>', 'Parallel LLM calls (default: 3)', '3')
  .option('--structural-only', 'Generate wiki using only structural graph data (no LLM, fast & free)')
  .option('--gist', 'Publish wiki as a public GitHub Gist after generation')
  .action(wikiCommand);

program
  .command('augment <pattern>')
  .description('Augment a search pattern with knowledge graph context (used by hooks)')
  .action(augmentCommand);

// ─── Direct Tool Commands (no MCP overhead) ────────────────────────
// These invoke LocalBackend directly for use in eval, scripts, and CI.

program
  .command('query <search_query>')
  .description('Search the knowledge graph for execution flows related to a concept')
  .option('-r, --repo <name>', 'Target repository (omit if only one indexed)')
  .option('-c, --context <text>', 'Task context to improve ranking')
  .option('-g, --goal <text>', 'What you want to find')
  .option('-l, --limit <n>', 'Max processes to return (default: 5)')
  .option('--content', 'Include full symbol source code')
  .action(queryCommand);

program
  .command('context [name]')
  .description('360-degree view of a code symbol: callers, callees, processes')
  .option('-r, --repo <name>', 'Target repository')
  .option('-u, --uid <uid>', 'Direct symbol UID (zero-ambiguity lookup)')
  .option('-f, --file <path>', 'File path to disambiguate common names')
  .option('--content', 'Include full symbol source code')
  .action(contextCommand);

program
  .command('impact <target>')
  .description('Blast radius analysis: what breaks if you change a symbol')
  .option('-d, --direction <dir>', 'upstream (dependants) or downstream (dependencies)', 'upstream')
  .option('-r, --repo <name>', 'Target repository')
  .option('--depth <n>', 'Max relationship depth (default: 3)')
  .option('--include-tests', 'Include test files in results')
  .action(impactCommand);

program
  .command('cypher <query>')
  .description('Execute raw Cypher query against the knowledge graph')
  .option('-r, --repo <name>', 'Target repository')
  .action(cypherCommand);

program
  .command('detect-impact')
  .description('CI/CD Bot: Auto-calculate blast radius against a base ref and output Markdown')
  .option('--base <ref>', 'Base git branch or commit (default: HEAD~1)', 'HEAD~1')
  .option('-r, --repo <name>', 'Target repository')
  .option('--json', 'Output raw JSON instead of markdown')
  .action(detectImpactCommand);

program
  .command('diagram')
  .description('Generate architecture diagram from knowledge graph')
  .option('-r, --repo <name>', 'Target repository')
  .option('-f, --format <format>', 'Output format: drawio, mermaid, svg (default: drawio)', 'drawio')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--include-external', 'Include external dependencies in diagram')
  .action(diagramCommand);

program
  .command('finops')
  .description('Detect FinOps issues in codebase')
  .option('-r, --repo <name>', 'Target repository')
  .option('-s, --severity <level>', 'Filter by severity: all, critical, high, medium, low (default: all)', 'all')
  .option('--json', 'Output raw JSON instead of markdown')
  .action(finopsCommand);

// ─── Eval Server (persistent daemon for SWE-bench) ─────────────────

program
  .command('eval-server')
  .description('Start lightweight HTTP server for fast tool calls during evaluation')
  .option('-p, --port <port>', 'Port number', '4848')
  .option('--idle-timeout <seconds>', 'Auto-shutdown after N seconds idle (0 = disabled)', '0')
  .action(evalServerCommand);

program.parse(process.argv);
