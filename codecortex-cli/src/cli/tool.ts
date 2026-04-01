/**
 * Direct CLI Tool Commands
 * 
 * Exposes CodeCortex tools (query, context, impact, cypher) as direct CLI commands.
 * Bypasses MCP entirely — invokes LocalBackend directly for minimal overhead.
 * 
 * Usage:
 *   codecortex query "authentication flow"
 *   codecortex context --name "validateUser"
 *   codecortex impact --target "AuthService" --direction upstream
 *   codecortex cypher "MATCH (n:Function) RETURN n.name LIMIT 10"
 * 
 * Note: Output goes to stderr because KuzuDB's native module captures stdout
 * at the OS level during init. This is consistent with augment.ts.
 */

import { LocalBackend } from '../mcp/local/local-backend.js';

let _backend: LocalBackend | null = null;

async function getBackend(): Promise<LocalBackend> {
  if (_backend) return _backend;
  _backend = new LocalBackend();
  const ok = await _backend.init();
  if (!ok) {
    console.error('CodeCortex: No indexed repositories found. Run: codecortex analyze');
    process.exit(1);
  }
  return _backend;
}

function output(data: any): void {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  // stderr because KuzuDB captures stdout at OS level
  process.stderr.write(text + '\n');
}

export async function queryCommand(queryText: string, options?: {
  repo?: string;
  context?: string;
  goal?: string;
  limit?: string;
  content?: boolean;
}): Promise<void> {
  if (!queryText?.trim()) {
    console.error('Usage: codecortex query <search_query>');
    process.exit(1);
  }

  const backend = await getBackend();
  const result = await backend.callTool('query', {
    query: queryText,
    task_context: options?.context,
    goal: options?.goal,
    limit: options?.limit ? parseInt(options.limit) : undefined,
    include_content: options?.content ?? false,
    repo: options?.repo,
  });
  output(result);
}

export async function contextCommand(name: string, options?: {
  repo?: string;
  file?: string;
  uid?: string;
  content?: boolean;
}): Promise<void> {
  if (!name?.trim() && !options?.uid) {
    console.error('Usage: codecortex context <symbol_name> [--uid <uid>] [--file <path>]');
    process.exit(1);
  }

  const backend = await getBackend();
  const result = await backend.callTool('context', {
    name: name || undefined,
    uid: options?.uid,
    file_path: options?.file,
    include_content: options?.content ?? false,
    repo: options?.repo,
  });
  output(result);
}

export async function impactCommand(target: string, options?: {
  direction?: string;
  repo?: string;
  depth?: string;
  includeTests?: boolean;
}): Promise<void> {
  if (!target?.trim()) {
    console.error('Usage: codecortex impact <symbol_name> [--direction upstream|downstream]');
    process.exit(1);
  }

  const backend = await getBackend();
  const result = await backend.callTool('impact', {
    target,
    direction: options?.direction || 'upstream',
    maxDepth: options?.depth ? parseInt(options.depth) : undefined,
    includeTests: options?.includeTests ?? false,
    repo: options?.repo,
  });
  output(result);
}

export async function cypherCommand(query: string, options?: {
  repo?: string;
}): Promise<void> {
  if (!query?.trim()) {
    console.error('Usage: codecortex cypher <cypher_query>');
    process.exit(1);
  }

  const backend = await getBackend();
  const result = await backend.callTool('cypher', {
    query,
    repo: options?.repo,
  });
  output(result);
}

export async function detectImpactCommand(options?: {
  base?: string;
  repo?: string;
  json?: boolean;
}): Promise<void> {
  const backend = await getBackend();
  const baseRef = options?.base || 'HEAD~1';
  
  const result = await backend.callTool('detect_changes', {
    scope: 'compare',
    base_ref: baseRef,
    repo: options?.repo,
  });

  if (options?.json) {
    output(result);
    return;
  }

  // Format as Markdown for CI / PR Bot
  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const { summary, changed_symbols, affected_processes } = result;

  let md = `## CodeCortex Impact Analysis\n\n`;
  
  if (summary.changed_count === 0) {
    md += `✅ **No structural code changes detected** against \`${baseRef}\`.\n`;
    process.stdout.write(md + '\n');
    return;
  }

  const riskWarning = 
    summary.risk_level === 'critical' ? '🚨 **CRITICAL RISK**' :
    summary.risk_level === 'high' ? '⚠️ **HIGH RISK**' :
    summary.risk_level === 'medium' ? '🔶 **MEDIUM RISK**' : '✅ **LOW RISK**';

  md += `### ${riskWarning}\n\n`;
  md += `- **Changed Files:** ${summary.changed_files}\n`;
  md += `- **Modified Graph Nodes:** ${summary.changed_count}\n`;
  md += `- **Downstream Processes At Risk:** ${summary.affected_count}\n\n`;

  if (affected_processes && affected_processes.length > 0) {
    md += `### 💥 Blast Radius (Affected Processes)\n\n`;
    md += `The following end-to-end execution flows trace through your modified code and should be manually tested:\n\n`;
    
    for (const proc of affected_processes) {
      md += `<details><summary>\`${proc.name || proc.id}\`</summary>\n\n`;
      md += `- **Type:** ${proc.process_type || 'Unknown'}\n`;
      md += `- **Total Steps:** ${proc.step_count || '?'}\n`;
      md += `- **Modified Steps:**\n`;
      for (const step of proc.changed_steps || []) {
        md += `  - Step ${step.step}: \`${step.symbol}\`\n`;
      }
      md += `\n</details>\n`;
    }
  } else {
    md += `*No major execution flows appear to be structurally affected by this change.*\n`;
  }

  // Print directly to stdout for bash piping
  process.stdout.write(md + '\n');
}

