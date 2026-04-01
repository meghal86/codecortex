/**
 * MCP Tool Definitions
 * 
 * Defines the tools that CodeCortex exposes to external AI agents.
 * All tools support an optional `repo` parameter for multi-repo setups.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      default?: any;
      items?: { type: string };
      enum?: string[];
    }>;
    required: string[];
  };
}

export const CODECORTEX_TOOLS: ToolDefinition[] = [
  {
    name: 'list_repos',
    description: `List all indexed repositories available to CodeCortex.

Returns each repo's name, path, indexed date, last commit, and stats.

WHEN TO USE: First step when multiple repos are indexed, or to discover available repos.
AFTER THIS: READ codecortex://repo/{name}/context for the repo you want to work with.

When multiple repos are indexed, you MUST specify the "repo" parameter
on other tools (query, context, impact, etc.) to target the correct one.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'taint_trace',
    description: `Trace data flow from a source node to potential security sinks.
Returns exact paths to sensitive endpoints (e.g., File System, DB, Network, Auth, OS).

WHEN TO USE: Performing security audits, tracking how user input flows to a sensitive operation, or verifying data sanitization.
AFTER THIS: Review the paths returned to ensure proper validation/escaping exists along them.`,
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'The unique ID of the symbol/node to trace from (e.g., from a query or context result).' },
        repo: { type: 'string', description: 'Target repository' }
      },
      required: ['node_id'],
    },
  },
  {
    name: 'query',
    description: `Query the code knowledge graph for execution flows related to a concept.
Returns processes (call chains) ranked by relevance, each with its symbols and file locations.

WHEN TO USE: Understanding how code works together. Use this when you need execution flows and relationships, not just file matches. Complements grep/IDE search.
AFTER THIS: Use context() on a specific symbol for 360-degree view (callers, callees, categorized refs).

Returns results grouped by process (execution flow):
- processes: ranked execution flows with relevance priority
- process_symbols: all symbols in those flows with file locations and module (functional area)
- definitions: standalone types/interfaces not in any process

Hybrid ranking: BM25 keyword + semantic vector search, ranked by Reciprocal Rank Fusion.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language or keyword search query' },
        task_context: { type: 'string', description: 'What you are working on (e.g., "adding OAuth support"). Helps ranking.' },
        goal: { type: 'string', description: 'What you want to find (e.g., "existing auth validation logic"). Helps ranking.' },
        limit: { type: 'number', description: 'Max processes to return (default: 5)', default: 5 },
        max_symbols: { type: 'number', description: 'Max symbols per process (default: 10)', default: 10 },
        include_content: { type: 'boolean', description: 'Include full symbol source code (default: false)', default: false },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'cypher',
    description: `Execute Cypher query against the code knowledge graph.

WHEN TO USE: Complex structural queries that search/explore can't answer. READ codecortex://repo/{name}/schema first for the full schema.
AFTER THIS: Use context() on result symbols for deeper context.

SCHEMA:
- Nodes: File, Folder, Function, Class, Interface, Method, CodeElement, Community, Process
- Multi-language nodes (use backticks): \`Struct\`, \`Enum\`, \`Trait\`, \`Impl\`, etc.
- All edges via single CodeRelation table with 'type' property
- Edge types: CONTAINS, DEFINES, CALLS, IMPORTS, EXTENDS, IMPLEMENTS, MEMBER_OF, STEP_IN_PROCESS
- Edge properties: type (STRING), confidence (DOUBLE), reason (STRING), step (INT32)

EXAMPLES:
• Find callers of a function:
  MATCH (a)-[:CodeRelation {type: 'CALLS'}]->(b:Function {name: "validateUser"}) RETURN a.name, a.filePath

• Find community members:
  MATCH (f)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community) WHERE c.heuristicLabel = "Auth" RETURN f.name

• Trace a process:
  MATCH (s)-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process) WHERE p.heuristicLabel = "UserLogin" RETURN s.name, r.step ORDER BY r.step

OUTPUT: Returns { markdown, row_count } — results formatted as a Markdown table for easy reading.

TIPS:
- All relationships use single CodeRelation table — filter with {type: 'CALLS'} etc.
- Community = auto-detected functional area (Leiden algorithm)
- Process = execution flow trace from entry point to terminal
- Use heuristicLabel (not label) for human-readable community/process names`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Cypher query to execute' },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'context',
    description: `360-degree view of a single code symbol.
Shows categorized incoming/outgoing references (calls, imports, extends, implements), process participation, and file location.

WHEN TO USE: After query() to understand a specific symbol in depth. When you need to know all callers, callees, and what execution flows a symbol participates in.
AFTER THIS: Use impact() if planning changes, or READ codecortex://repo/{name}/process/{processName} for full execution trace.

Handles disambiguation: if multiple symbols share the same name, returns candidates for you to pick from. Use uid param for zero-ambiguity lookup from prior results.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Symbol name (e.g., "validateUser", "AuthService")' },
        uid: { type: 'string', description: 'Direct symbol UID from prior tool results (zero-ambiguity lookup)' },
        file_path: { type: 'string', description: 'File path to disambiguate common names' },
        include_content: { type: 'boolean', description: 'Include full symbol source code (default: false)', default: false },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: [],
    },
  },
  {
    name: 'detect_changes',
    description: `Analyze uncommitted git changes and find affected execution flows.
Maps git diff hunks to indexed symbols, then traces which processes are impacted.

WHEN TO USE: Before committing — to understand what your changes affect. Pre-commit review, PR preparation.
AFTER THIS: Review affected processes. Use context() on high-risk symbols. READ codecortex://repo/{name}/process/{name} for full traces.

Returns: changed symbols, affected processes, and a risk summary.`,
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'What to analyze: "unstaged" (default), "staged", "all", or "compare"', enum: ['unstaged', 'staged', 'all', 'compare'], default: 'unstaged' },
        base_ref: { type: 'string', description: 'Branch/commit for "compare" scope (e.g., "main")' },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: [],
    },
  },
  {
    name: 'rename',
    description: `Multi-file coordinated rename using the knowledge graph + text search.
Finds all references via graph (high confidence) and regex text search (lower confidence). Preview by default.

WHEN TO USE: Renaming a function, class, method, or variable across the codebase. Safer than find-and-replace.
AFTER THIS: Run detect_changes() to verify no unexpected side effects.

Each edit is tagged with confidence:
- "graph": found via knowledge graph relationships (high confidence, safe to accept)
- "text_search": found via regex text search (lower confidence, review carefully)`,
    inputSchema: {
      type: 'object',
      properties: {
        symbol_name: { type: 'string', description: 'Current symbol name to rename' },
        symbol_uid: { type: 'string', description: 'Direct symbol UID from prior tool results (zero-ambiguity)' },
        new_name: { type: 'string', description: 'The new name for the symbol' },
        file_path: { type: 'string', description: 'File path to disambiguate common names' },
        dry_run: { type: 'boolean', description: 'Preview edits without modifying files (default: true)', default: true },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: ['new_name'],
    },
  },
  {
    name: 'impact',
    description: `Analyze the blast radius of changing a code symbol.
Returns affected symbols grouped by depth, plus risk assessment, affected execution flows, and affected modules.

WHEN TO USE: Before making code changes — especially refactoring, renaming, or modifying shared code. Shows what would break.
AFTER THIS: Review d=1 items (WILL BREAK). Use context() on high-risk symbols.

Output includes:
- risk: LOW / MEDIUM / HIGH / CRITICAL
- summary: direct callers, processes affected, modules affected
- affected_processes: which execution flows break and at which step
- affected_modules: which functional areas are hit (direct vs indirect)
- byDepth: all affected symbols grouped by traversal depth

Depth groups:
- d=1: WILL BREAK (direct callers/importers)
- d=2: LIKELY AFFECTED (indirect)
- d=3: MAY NEED TESTING (transitive)

EdgeType: CALLS, IMPORTS, EXTENDS, IMPLEMENTS
Confidence: 1.0 = certain, <0.8 = fuzzy match`,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Name of function, class, or file to analyze' },
        direction: { type: 'string', description: 'upstream (what depends on this) or downstream (what this depends on)' },
        maxDepth: { type: 'number', description: 'Max relationship depth (default: 3)', default: 3 },
        relationTypes: { type: 'array', items: { type: 'string' }, description: 'Filter: CALLS, IMPORTS, EXTENDS, IMPLEMENTS (default: usage-based)' },
        includeTests: { type: 'boolean', description: 'Include test files (default: false)' },
        minConfidence: { type: 'number', description: 'Minimum confidence 0-1 (default: 0.7)' },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: ['target', 'direction'],
    },
  },
  {
    name: 'check_guardrails',
    description: `Check if a proposed change violates architectural rules.
Returns violations, warnings, and suggestions for safe alternatives.

WHEN TO USE: Before making code changes — especially when adding imports, creating dependencies, or modifying shared code. Use this to catch architectural violations before they ship.
AFTER THIS: Review violations and fix them before committing. Use impact() to understand the full blast radius.

Architectural rules are defined in .codecortex/rules.json or use built-in defaults:
- UI layer should not directly access database layer
- Controllers should not directly import business logic
- No circular dependencies between modules
- Test files should not import production code
- Entry points should not be called by other entry points

Returns:
- violations: rules that were broken (must fix)
- warnings: potential issues (should review)
- suggestions: safer alternatives
- risk_level: LOW / MEDIUM / HIGH / CRITICAL`,
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'File path to check (relative to repo root)' },
        symbol_name: { type: 'string', description: 'Symbol name to check (optional)' },
        change_type: { type: 'string', description: 'Type of change: add_import, modify_function, add_dependency, etc.', enum: ['add_import', 'modify_function', 'add_dependency', 'create_file', 'delete_file', 'rename'] },
        target_symbol: { type: 'string', description: 'Target symbol for import/dependency (optional)' },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: ['file_path', 'change_type'],
    },
  },
  {
    name: 'generate_diagram',
    description: `Generate architecture diagram from the knowledge graph.
Returns diagram in specified format (draw.io, Mermaid, or SVG).

WHEN TO USE: After indexing a repo — to visualize the architecture, understand module relationships, or create documentation.
AFTER THIS: Review the diagram to understand the system structure. Use impact() to analyze specific components.

The diagram shows:
- Module/component relationships
- Dependency flows
- External integrations
- Layer separation (UI, Service, Data, etc.)

Output formats:
- drawio: XML format for draw.io editor
- mermaid: Markdown-based diagram syntax
- svg: Vector graphics format`,
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Output format: drawio, mermaid, svg (default: drawio)', enum: ['drawio', 'mermaid', 'svg'], default: 'drawio' },
        include_external: { type: 'boolean', description: 'Include external dependencies (default: false)', default: false },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: [],
    },
  },
  {
    name: 'detect_finops',
    description: `Detect financial operations (FinOps) issues in the codebase.
Returns issues related to cloud resource usage, cost optimization, and efficiency.

WHEN TO USE: After indexing a repo — to identify cost optimization opportunities, inefficient resource usage, or missing cost controls.
AFTER THIS: Review issues by severity. Use context() on affected symbols to understand the full impact.

Detects:
- Unoptimized cloud resource usage (over-provisioned instances, unused resources)
- Missing cost tags/labels
- Inefficient database queries (N+1 queries, missing indexes)
- Unnecessary API calls (missing caching, redundant requests)
- Missing caching strategies
- Network inefficiencies (large payloads, missing compression)
- Storage issues (unnecessary data retention, missing lifecycle policies)

Returns:
- issues: array of detected issues with severity, category, file, and suggestion
- summary: count by severity level
- estimated_savings: potential cost savings (if calculable)`,
    inputSchema: {
      type: 'object',
      properties: {
        severity: { type: 'string', description: 'Filter by severity: all, critical, high, medium, low (default: all)', enum: ['all', 'critical', 'high', 'medium', 'low'], default: 'all' },
        repo: { type: 'string', description: 'Repository name or path. Omit if only one repo is indexed.' },
      },
      required: [],
    },
  },
];
