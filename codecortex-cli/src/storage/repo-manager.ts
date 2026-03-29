/**
 * Repository Manager
 * 
 * Manages CodeCortex index storage in .codecortex/ at repo root.
 * Also maintains a global registry at ~/.codecortex/registry.json
 * so the MCP server can discover indexed repos from any cwd.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface RepoMeta {
  repoPath: string;
  lastCommit: string;
  indexedAt: string;
  stats?: {
    files?: number;
    nodes?: number;
    edges?: number;
    communities?: number;
    processes?: number;
    embeddings?: number;
  };
}

export interface HealthSnapshot {
  timestamp: string;
  commit: string;
  couplingScore: number;
  busFactor: number;
  deadCodePct: number;
  communityCount: number;
  cohesionAvg: number;
  hotspotCount: number;
  circularDeps: number;
}

export interface IndexedRepo {
  repoPath: string;
  storagePath: string;
  kuzuPath: string;
  metaPath: string;
  meta: RepoMeta;
}

/**
 * Shape of an entry in the global registry (~/.codecortex/registry.json)
 */
export interface RegistryEntry {
  name: string;
  path: string;
  storagePath: string;
  indexedAt: string;
  lastCommit: string;
  stats?: RepoMeta['stats'];
}

const CODECORTEX_DIR = '.codecortex';

// ─── Local Storage Helpers ─────────────────────────────────────────────

/**
 * Get the .codecortex storage path for a repository
 */
export const getStoragePath = (repoPath: string): string => {
  return path.join(path.resolve(repoPath), CODECORTEX_DIR);
};

/**
 * Get paths to key storage files
 */
export const getStoragePaths = (repoPath: string) => {
  const storagePath = getStoragePath(repoPath);
  return {
    storagePath,
    kuzuPath: path.join(storagePath, 'kuzu'),
    metaPath: path.join(storagePath, 'meta.json'),
  };
};

/**
 * Load metadata from an indexed repo
 */
export const loadMeta = async (storagePath: string): Promise<RepoMeta | null> => {
  try {
    const metaPath = path.join(storagePath, 'meta.json');
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw) as RepoMeta;
  } catch {
    return null;
  }
};

/**
 * Save metadata to storage
 */
export const saveMeta = async (storagePath: string, meta: RepoMeta): Promise<void> => {
  await fs.mkdir(storagePath, { recursive: true });
  const metaPath = path.join(storagePath, 'meta.json');
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
};

/**
 * Check if a path has a CodeCortex index
 */
export const hasIndex = async (repoPath: string): Promise<boolean> => {
  const { metaPath } = getStoragePaths(repoPath);
  try {
    await fs.access(metaPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Load an indexed repo from a path
 */
export const loadRepo = async (repoPath: string): Promise<IndexedRepo | null> => {
  const paths = getStoragePaths(repoPath);
  const meta = await loadMeta(paths.storagePath);
  if (!meta) return null;
  
  return {
    repoPath: path.resolve(repoPath),
    ...paths,
    meta,
  };
};

/**
 * Find .codecortex by walking up from a starting path
 */
export const findRepo = async (startPath: string): Promise<IndexedRepo | null> => {
  let current = path.resolve(startPath);
  const root = path.parse(current).root;
  
  while (current !== root) {
    const repo = await loadRepo(current);
    if (repo) return repo;
    current = path.dirname(current);
  }
  
  return null;
};

/**
 * Add .codecortex to .gitignore if not already present
 */
export const addToGitignore = async (repoPath: string): Promise<void> => {
  const gitignorePath = path.join(repoPath, '.gitignore');
  
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (content.includes(CODECORTEX_DIR)) return;
    
    const newContent = content.endsWith('\n') 
      ? `${content}${CODECORTEX_DIR}\n`
      : `${content}\n${CODECORTEX_DIR}\n`;
    await fs.writeFile(gitignorePath, newContent, 'utf-8');
  } catch {
    // .gitignore doesn't exist, create it
    await fs.writeFile(gitignorePath, `${CODECORTEX_DIR}\n`, 'utf-8');
  }
};

/**
 * Append a health snapshot to the repo's health history
 */
export const saveHealthSnapshot = async (storagePath: string, snapshot: HealthSnapshot): Promise<void> => {
  const historyPath = path.join(storagePath, 'health-history.json');
  let history: HealthSnapshot[] = [];
  try {
    const raw = await fs.readFile(historyPath, 'utf-8');
    history = JSON.parse(raw);
    if (!Array.isArray(history)) history = [];
  } catch {
    // File might not exist yet
  }
  history.push(snapshot);
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
};

/**
 * Load the health history for a repo
 */
export const loadHealthHistory = async (storagePath: string): Promise<HealthSnapshot[]> => {
  const historyPath = path.join(storagePath, 'health-history.json');
  try {
    const raw = await fs.readFile(historyPath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// ─── Global Registry (~/.codecortex/registry.json) ───────────────────────

/**
 * Get the path to the global CodeCortex directory
 */
export const getGlobalDir = (): string => {
  return path.join(os.homedir(), '.codecortex');
};

/**
 * Get the path to the global registry file
 */
export const getGlobalRegistryPath = (): string => {
  return path.join(getGlobalDir(), 'registry.json');
};

/**
 * Read the global registry. Returns empty array if not found.
 */
export const readRegistry = async (): Promise<RegistryEntry[]> => {
  try {
    const raw = await fs.readFile(getGlobalRegistryPath(), 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * Write the global registry to disk
 */
const writeRegistry = async (entries: RegistryEntry[]): Promise<void> => {
  const dir = getGlobalDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getGlobalRegistryPath(), JSON.stringify(entries, null, 2), 'utf-8');
};

/**
 * Register (add or update) a repo in the global registry.
 * Called after `codecortex analyze` completes.
 */
export const registerRepo = async (repoPath: string, meta: RepoMeta): Promise<void> => {
  const resolved = path.resolve(repoPath);
  const name = path.basename(resolved);
  const { storagePath } = getStoragePaths(resolved);

  const entries = await readRegistry();
  const existing = entries.findIndex((e) => {
    const a = path.resolve(e.path);
    const b = resolved;
    return process.platform === 'win32'
      ? a.toLowerCase() === b.toLowerCase()
      : a === b;
  });

  const entry: RegistryEntry = {
    name,
    path: resolved,
    storagePath,
    indexedAt: meta.indexedAt,
    lastCommit: meta.lastCommit,
    stats: meta.stats,
  };

  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }

  await writeRegistry(entries);
};

/**
 * Remove a repo from the global registry.
 * Called after `codecortex clean`.
 */
export const unregisterRepo = async (repoPath: string): Promise<void> => {
  const resolved = path.resolve(repoPath);
  const entries = await readRegistry();
  const filtered = entries.filter(
    (e) => path.resolve(e.path) !== resolved
  );
  await writeRegistry(filtered);
};

/**
 * List all registered repos from the global registry.
 * Optionally validates that each entry's .codecortex/ still exists.
 */
export const listRegisteredRepos = async (opts?: { validate?: boolean }): Promise<RegistryEntry[]> => {
  const entries = await readRegistry();
  if (!opts?.validate) return entries;

  // Validate each entry still has a .codecortex/ directory
  const valid: RegistryEntry[] = [];
  for (const entry of entries) {
    try {
      await fs.access(path.join(entry.storagePath, 'meta.json'));
      valid.push(entry);
    } catch {
      // Index no longer exists — skip
    }
  }

  // If we pruned any entries, save the cleaned registry
  if (valid.length !== entries.length) {
    await writeRegistry(valid);
  }

  return valid;
};

// ─── Global CLI Config (~/.codecortex/config.json) ─────────────────────────

export interface CLIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Get the path to the global CLI config file
 */
export const getGlobalConfigPath = (): string => {
  return path.join(getGlobalDir(), 'config.json');
};

/**
 * Load CLI config from ~/.codecortex/config.json
 */
export const loadCLIConfig = async (): Promise<CLIConfig> => {
  try {
    const raw = await fs.readFile(getGlobalConfigPath(), 'utf-8');
    return JSON.parse(raw) as CLIConfig;
  } catch {
    return {};
  }
};

/**
 * Save CLI config to ~/.codecortex/config.json
 */
export const saveCLIConfig = async (config: CLIConfig): Promise<void> => {
  const dir = getGlobalDir();
  await fs.mkdir(dir, { recursive: true });
  const configPath = getGlobalConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  // Restrict file permissions on Unix (config may contain API keys)
  if (process.platform !== 'win32') {
    try { await fs.chmod(configPath, 0o600); } catch { /* best-effort */ }
  }
};
