/**
 * Architecture Diagram Generator
 * 
 * Generates architecture diagrams from the knowledge graph.
 * Supports multiple output formats: draw.io, Mermaid, SVG.
 */

import { getBackend } from '../mcp/local/local-backend.js';
import { output } from '../lib/utils.js';

interface DiagramOptions {
  repo?: string;
  format?: 'drawio' | 'mermaid' | 'svg';
  output?: string;
  includeExternal?: boolean;
}

/**
 * Generate architecture diagram command
 */
export async function diagramCommand(options?: DiagramOptions): Promise<void> {
  const backend = await getBackend();
  const format = options?.format || 'drawio';
  
  const result = await backend.callTool('generate_diagram', {
    repo: options?.repo,
    format,
    include_external: options?.includeExternal || false,
  });

  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  // Output to file or stdout
  if (options?.output) {
    const fs = await import('fs/promises');
    await fs.writeFile(options.output, result.diagram);
    console.log(`✅ Diagram saved to ${options.output}`);
  } else {
    output(result.diagram);
  }
}
