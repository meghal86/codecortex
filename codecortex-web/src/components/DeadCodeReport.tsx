import React, { useMemo, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { X, Search, Trash2, ArrowRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { GraphNode } from '../core/graph/types';

interface DeadCodeEntry {
  node: GraphNode;
  filePath: string;
  community: string;
  linesOfCode: number;
}

const TEST_PATH_PATTERNS = [
  /__tests__\//i,
  /\/test\//i,
  /\/spec\//i,
  /\.test\./i,
  /\.spec\./i,
  /_test\./i,
  /\_spec\./i,
  /\/fixtures\//i,
  /\/mocks?\//i,
];

const CALLABLE_LABELS = new Set(['Function', 'Method', 'Class', 'Interface', 'Type']);

export const DeadCodeReport: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
}> = ({ isOpen, onClose, onFocusNode }) => {
  const { graph } = useAppState();
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'community'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');

  const { entries, totalEstimatedLines, modules } = useMemo(() => {
    if (!graph) return { entries: [], totalEstimatedLines: 0, modules: [] as string[] };

    // Build set of nodes that have incoming dependency edges
    const incoming = new Set<string>();
    for (const rel of graph.relationships) {
      if (['CALLS', 'IMPORTS', 'USES', 'EXTENDS', 'IMPLEMENTS'].includes(rel.type)) {
        incoming.add(rel.targetId);
      }
    }

    const deadNodes: DeadCodeEntry[] = [];
    const moduleSet = new Set<string>();

    for (const n of graph.nodes) {
      // Must be a callable type
      if (!CALLABLE_LABELS.has(n.label)) continue;

      // Must not be an entry point
      if (n.properties.entryPointReason) continue;

      // Must have 0 incoming dependency edges
      if (incoming.has(n.id)) continue;

      // Must not be in a test path
      const fp = n.properties.filePath || '';
      const isTestFile = TEST_PATH_PATTERNS.some(p => p.test(fp));
      if (isTestFile) continue;

      // Skip hidden nodes
      if (n.properties.hidden) continue;

      const community = n.properties.community !== undefined ? `Domain ${n.properties.community}` : 'Uncategorized';
      moduleSet.add(community);

      deadNodes.push({
        node: n,
        filePath: fp,
        community,
        linesOfCode: n.properties.lineCount || n.properties.loc || 0,
      });
    }

    const totalLines = deadNodes.reduce((sum, e) => sum + e.linesOfCode, 0);
    return {
      entries: deadNodes,
      totalEstimatedLines: totalLines,
      modules: Array.from(moduleSet).sort(),
    };
  }, [graph]);

  const filtered = useMemo(() => {
    let result = entries;

    if (moduleFilter !== 'all') {
      result = result.filter(e => e.community === moduleFilter);
    }

    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(e =>
        e.node.properties.name.toLowerCase().includes(q) ||
        e.filePath.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.node.properties.name.localeCompare(b.node.properties.name);
      else if (sortBy === 'type') cmp = a.node.label.localeCompare(b.node.label);
      else if (sortBy === 'community') cmp = a.community.localeCompare(b.community);
      return sortAsc ? cmp : -cmp;
    });
  }, [entries, filter, sortBy, sortAsc, moduleFilter]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  const fileCount = new Set(filtered.map(e => e.filePath)).size;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[80vh] bg-[#0a0a0a] border border-[#1c1c1c] rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#ededed]">Dead Code Report</h2>
              <p className="text-[11px] text-[#52525b]">
                Symbols with 0 callers that are not tests or entry points
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/[0.05] text-[#52525b] hover:text-[#ededed] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-6 px-6 py-3 border-b border-[#1c1c1c] bg-[#050505]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[12px] text-[#ededed] font-medium">{entries.length} dead symbols</span>
          </div>
          <div className="text-[11px] text-[#52525b]">
            across <span className="text-[#a1a1aa] font-mono">{new Set(entries.map(e => e.filePath)).size}</span> files
          </div>
          {totalEstimatedLines > 0 && (
            <div className="text-[11px] text-[#52525b]">
              ~<span className="text-amber-400 font-mono">{totalEstimatedLines.toLocaleString()}</span> lines of removable code
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-[#1c1c1c]">
          <div className="flex-1 flex items-center gap-2 h-7 px-2.5 bg-[#050505] border border-[#1c1c1c] rounded">
            <Search className="w-3 h-3 text-[#3f3f46]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or path..."
              className="flex-1 bg-transparent border-none outline-none text-[11px] text-[#ededed] placeholder:text-[#3f3f46]"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="h-7 px-2 bg-[#050505] border border-[#1c1c1c] rounded text-[11px] text-[#a1a1aa] outline-none"
          >
            <option value="all">All modules</option>
            {modules.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#52525b]">
              <Trash2 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[11px]">
                {entries.length === 0
                  ? 'No dead code found — your codebase looks clean! 🎉'
                  : 'No results match your filter'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                <tr className="text-[9px] uppercase tracking-wider text-[#52525b] border-b border-[#1c1c1c]">
                  <th className="py-2 px-6 font-medium cursor-pointer hover:text-[#a1a1aa]" onClick={() => toggleSort('name')}>
                    Symbol <SortIcon col="name" />
                  </th>
                  <th className="py-2 px-4 font-medium cursor-pointer hover:text-[#a1a1aa]" onClick={() => toggleSort('type')}>
                    Type <SortIcon col="type" />
                  </th>
                  <th className="py-2 px-4 font-medium">File</th>
                  <th className="py-2 px-4 font-medium cursor-pointer hover:text-[#a1a1aa]" onClick={() => toggleSort('community')}>
                    Module <SortIcon col="community" />
                  </th>
                  <th className="py-2 px-4 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.node.id}
                    onClick={() => { onFocusNode?.(entry.node.id); onClose(); }}
                    className="border-t border-[#1c1c1c]/30 hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="py-2 px-6">
                      <span className="text-[12px] font-medium text-[#ededed]">{entry.node.properties.name}</span>
                    </td>
                    <td className="py-2 px-4">
                      <span className="text-[10px] font-mono text-[#52525b] px-1.5 py-0.5 bg-[#141414] border border-[#1c1c1c] rounded">
                        {entry.node.label}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-[10px] text-[#3f3f46] truncate max-w-[200px]">{entry.filePath}</td>
                    <td className="py-2 px-4 text-[10px] text-[#52525b] font-mono">{entry.community}</td>
                    <td className="py-2 px-4">
                      <ArrowRight className="w-3 h-3 text-[#3f3f46] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1c1c1c] bg-[#050505] flex items-center justify-between">
          <span className="text-[10px] text-[#3f3f46]">
            Showing {filtered.length} of {entries.length} dead symbols across {fileCount} files
          </span>
          <span className="text-[10px] text-[#3f3f46]">
            Click a row to focus on graph
          </span>
        </div>
      </div>
    </div>
  );
};
