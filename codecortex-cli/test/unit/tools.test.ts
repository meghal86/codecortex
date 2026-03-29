/**
 * Unit Tests: MCP Tool Definitions
 *
 * Tests: CODECORTEX_TOOLS from tools.ts
 * - All 7 tools are defined
 * - Each tool has valid name, description, inputSchema
 * - Required fields are correct
 * - Optional repo parameter is present on tools that need it
 */
import { describe, it, expect } from 'vitest';
import { CODECORTEX_TOOLS, type ToolDefinition } from '../../src/mcp/tools.js';

describe('CODECORTEX_TOOLS', () => {
  it('exports exactly 7 tools', () => {
    expect(CODECORTEX_TOOLS).toHaveLength(7);
  });

  it('contains all expected tool names', () => {
    const names = CODECORTEX_TOOLS.map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_repos', 'query', 'cypher', 'context',
        'detect_changes', 'rename', 'impact',
      ])
    );
  });

  it('each tool has name, description, and inputSchema', () => {
    for (const tool of CODECORTEX_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
    }
  });

  it('query tool requires "query" parameter', () => {
    const queryTool = CODECORTEX_TOOLS.find(t => t.name === 'query')!;
    expect(queryTool.inputSchema.required).toContain('query');
    expect(queryTool.inputSchema.properties.query).toBeDefined();
    expect(queryTool.inputSchema.properties.query.type).toBe('string');
  });

  it('cypher tool requires "query" parameter', () => {
    const cypherTool = CODECORTEX_TOOLS.find(t => t.name === 'cypher')!;
    expect(cypherTool.inputSchema.required).toContain('query');
  });

  it('context tool has no required parameters', () => {
    const contextTool = CODECORTEX_TOOLS.find(t => t.name === 'context')!;
    expect(contextTool.inputSchema.required).toEqual([]);
  });

  it('impact tool requires target and direction', () => {
    const impactTool = CODECORTEX_TOOLS.find(t => t.name === 'impact')!;
    expect(impactTool.inputSchema.required).toContain('target');
    expect(impactTool.inputSchema.required).toContain('direction');
  });

  it('rename tool requires new_name', () => {
    const renameTool = CODECORTEX_TOOLS.find(t => t.name === 'rename')!;
    expect(renameTool.inputSchema.required).toContain('new_name');
  });

  it('detect_changes tool has no required parameters', () => {
    const detectTool = CODECORTEX_TOOLS.find(t => t.name === 'detect_changes')!;
    expect(detectTool.inputSchema.required).toEqual([]);
  });

  it('list_repos tool has no parameters', () => {
    const listTool = CODECORTEX_TOOLS.find(t => t.name === 'list_repos')!;
    expect(Object.keys(listTool.inputSchema.properties)).toHaveLength(0);
    expect(listTool.inputSchema.required).toEqual([]);
  });

  it('all tools except list_repos have optional repo parameter', () => {
    for (const tool of CODECORTEX_TOOLS) {
      if (tool.name === 'list_repos') continue;
      expect(tool.inputSchema.properties.repo).toBeDefined();
      expect(tool.inputSchema.properties.repo.type).toBe('string');
      // repo should never be required
      expect(tool.inputSchema.required).not.toContain('repo');
    }
  });

  it('detect_changes scope has correct enum values', () => {
    const detectTool = CODECORTEX_TOOLS.find(t => t.name === 'detect_changes')!;
    const scopeProp = detectTool.inputSchema.properties.scope;
    expect(scopeProp.enum).toEqual(['unstaged', 'staged', 'all', 'compare']);
  });

  it('impact relationTypes is array of strings', () => {
    const impactTool = CODECORTEX_TOOLS.find(t => t.name === 'impact')!;
    const relProp = impactTool.inputSchema.properties.relationTypes;
    expect(relProp.type).toBe('array');
    expect(relProp.items).toEqual({ type: 'string' });
  });
});
