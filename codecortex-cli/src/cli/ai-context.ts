/**
 * AI Context Generator
 * 
 * Creates AGENTS.md and CLAUDE.md with full inline CodeCortex context.
 * AGENTS.md is the standard read by Cursor, Windsurf, OpenCode, Cline, etc.
 * CLAUDE.md is for Claude Code which only reads that file.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RepoStats {
  files?: number;
  nodes?: number;
  edges?: number;
  communities?: number;
  clusters?: number;       // Aggregated cluster count (what tools show)
  processes?: number;
}

const CODECORTEX_START_MARKER = '<!-- codecortex:start -->';
const CODECORTEX_END_MARKER = '<!-- codecortex:end -->';

/**
 * Generate the full CodeCortex context content.
 * 
 * Design principles (learned from real agent behavior):
 * - AGENTS.md is the ROUTER — it tells the agent WHICH skill to read
 * - Skills contain the actual workflows — AGENTS.md does NOT duplicate them
 * - Bold **IMPORTANT** block + "Skills — Read First" heading — agents skip soft suggestions
 * - One-line quick start (read context resource) gives agents an entry point
 * - Tools/Resources sections are labeled "Reference" — agents treat them as lookup, not workflow
 */
function generateCodeCortexContent(projectName: string, stats: RepoStats): string {
  return `${CODECORTEX_START_MARKER}
# CodeCortex MCP

This project is indexed by CodeCortex as **${projectName}** (${stats.nodes || 0} symbols, ${stats.edges || 0} relationships, ${stats.processes || 0} execution flows).

## Always Start Here

1. **Read \`codecortex://repo/{name}/context\`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run \`npx codecortex analyze\` in the terminal first.

## Skills

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | \`.claude/skills/codecortex/codecortex-exploring/SKILL.md\` |
| Blast radius / "What breaks if I change X?" | \`.claude/skills/codecortex/codecortex-impact-analysis/SKILL.md\` |
| Trace bugs / "Why is X failing?" | \`.claude/skills/codecortex/codecortex-debugging/SKILL.md\` |
| Rename / extract / split / refactor | \`.claude/skills/codecortex/codecortex-refactoring/SKILL.md\` |
| Tools, resources, schema reference | \`.claude/skills/codecortex/codecortex-guide/SKILL.md\` |
| Index, status, clean, wiki CLI commands | \`.claude/skills/codecortex/codecortex-cli/SKILL.md\` |

${CODECORTEX_END_MARKER}`;
}


/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create or update CodeCortex section in a file
 * - If file doesn't exist: create with CodeCortex content
 * - If file exists without CodeCortex section: append
 * - If file exists with CodeCortex section: replace that section
 */
async function upsertCodeCortexSection(
  filePath: string,
  content: string
): Promise<'created' | 'updated' | 'appended'> {
  const exists = await fileExists(filePath);

  if (!exists) {
    await fs.writeFile(filePath, content, 'utf-8');
    return 'created';
  }

  const existingContent = await fs.readFile(filePath, 'utf-8');

  // Check if CodeCortex section already exists
  const startIdx = existingContent.indexOf(CODECORTEX_START_MARKER);
  const endIdx = existingContent.indexOf(CODECORTEX_END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing section
    const before = existingContent.substring(0, startIdx);
    const after = existingContent.substring(endIdx + CODECORTEX_END_MARKER.length);
    const newContent = before + content + after;
    await fs.writeFile(filePath, newContent.trim() + '\n', 'utf-8');
    return 'updated';
  }

  // Append new section
  const newContent = existingContent.trim() + '\n\n' + content + '\n';
  await fs.writeFile(filePath, newContent, 'utf-8');
  return 'appended';
}

/**
 * Install CodeCortex skills to .claude/skills/codecortex/
 * Works natively with Claude Code, Cursor, and GitHub Copilot
 */
async function installSkills(repoPath: string): Promise<string[]> {
  const skillsDir = path.join(repoPath, '.claude', 'skills', 'codecortex');
  const installedSkills: string[] = [];

  // Skill definitions bundled with the package
  const skills = [
    {
      name: 'codecortex-exploring',
      description: 'Use when the user asks how code works, wants to understand architecture, trace execution flows, or explore unfamiliar parts of the codebase. Examples: "How does X work?", "What calls this function?", "Show me the auth flow"',
    },
    {
      name: 'codecortex-debugging',
      description: 'Use when the user is debugging a bug, tracing an error, or asking why something fails. Examples: "Why is X failing?", "Where does this error come from?", "Trace this bug"',
    },
    {
      name: 'codecortex-impact-analysis',
      description: 'Use when the user wants to know what will break if they change something, or needs safety analysis before editing code. Examples: "Is it safe to change X?", "What depends on this?", "What will break?"',
    },
    {
      name: 'codecortex-refactoring',
      description: 'Use when the user wants to rename, extract, split, move, or restructure code safely. Examples: "Rename this function", "Extract this into a module", "Refactor this class", "Move this to a separate file"',
    },
    {
      name: 'codecortex-guide',
      description: 'Use when the user asks about CodeCortex itself — available tools, how to query the knowledge graph, MCP resources, graph schema, or workflow reference. Examples: "What CodeCortex tools are available?", "How do I use CodeCortex?"',
    },
    {
      name: 'codecortex-cli',
      description: 'Use when the user needs to run CodeCortex CLI commands like analyze/index a repo, check status, clean the index, generate a wiki, or list indexed repos. Examples: "Index this repo", "Reanalyze the codebase", "Generate a wiki"',
    },
  ];

  for (const skill of skills) {
    const skillDir = path.join(skillsDir, skill.name);
    const skillPath = path.join(skillDir, 'SKILL.md');

    try {
      // Create skill directory
      await fs.mkdir(skillDir, { recursive: true });

      // Try to read from package skills directory
      const packageSkillPath = path.join(__dirname, '..', '..', 'skills', `${skill.name}.md`);
      let skillContent: string;

      try {
        skillContent = await fs.readFile(packageSkillPath, 'utf-8');
      } catch {
        // Fallback: generate minimal skill content
        skillContent = `---
name: ${skill.name}
description: ${skill.description}
---

# ${skill.name.charAt(0).toUpperCase() + skill.name.slice(1)}

${skill.description}

Use CodeCortex tools to accomplish this task.
`;
      }

      await fs.writeFile(skillPath, skillContent, 'utf-8');
      installedSkills.push(skill.name);
    } catch (err) {
      // Skip on error, don't fail the whole process
      console.warn(`Warning: Could not install skill ${skill.name}:`, err);
    }
  }

  return installedSkills;
}

/**
 * Generate AI context files after indexing
 */
export async function generateAIContextFiles(
  repoPath: string,
  _storagePath: string,
  projectName: string,
  stats: RepoStats
): Promise<{ files: string[] }> {
  const content = generateCodeCortexContent(projectName, stats);
  const createdFiles: string[] = [];

  // Create AGENTS.md (standard for Cursor, Windsurf, OpenCode, Cline, etc.)
  const agentsPath = path.join(repoPath, 'AGENTS.md');
  const agentsResult = await upsertCodeCortexSection(agentsPath, content);
  createdFiles.push(`AGENTS.md (${agentsResult})`);

  // Create CLAUDE.md (for Claude Code)
  const claudePath = path.join(repoPath, 'CLAUDE.md');
  const claudeResult = await upsertCodeCortexSection(claudePath, content);
  createdFiles.push(`CLAUDE.md (${claudeResult})`);

  // Install skills to .claude/skills/codecortex/
  const installedSkills = await installSkills(repoPath);
  if (installedSkills.length > 0) {
    createdFiles.push(`.claude/skills/codecortex/ (${installedSkills.length} skills)`);
  }

  return { files: createdFiles };
}

