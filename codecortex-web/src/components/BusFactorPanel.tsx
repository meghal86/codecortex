import React, { useMemo, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { Users, AlertTriangle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { GraphNode } from '../core/graph/types';

interface BusFactorEntry {
  node: GraphNode;
  ownership: number;
  author: string;
  filePath: string;
  community: string;
}

export const BusFactorPanel: React.FC<{ onFocusNode?: (nodeId: string) => void }> = ({ onFocusNode }) => {
  const { graph } = useAppState();
  const [sortBy, setSortBy] = useState<'ownership' | 'name' | 'community'>('ownership');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('');

  const entries = useMemo<BusFactorEntry[]>(() => {
    if (!graph) return [];
    return graph.nodes
      .filter(n =>
        (n.properties.ownership || 0) > 0 &&
        n.label !== 'Folder' &&
        n.label !== 'Project' &&
        n.label !== 'Community'
      )
      .map(n => ({
        node: n,
        ownership: n.properties.ownership || 0,
        author: n.properties.author || 'Unknown',
        filePath: n.properties.filePath || '',
        community: n.properties.community !== undefined ? `Domain ${n.properties.community}` : '—',
      }))
      .sort((a, b) => b.ownership - a.ownership);
  }, [graph]);

  const filtered = useMemo(() => {
    let result = entries;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(e =>
        e.node.properties.name.toLowerCase().includes(q) ||
        e.filePath.toLowerCase().includes(q) ||
        e.author.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'ownership') cmp = a.ownership - b.ownership;
      else if (sortBy === 'name') cmp = a.node.properties.name.localeCompare(b.node.properties.name);
      else if (sortBy === 'community') cmp = a.community.localeCompare(b.community);
      return sortAsc ? cmp : -cmp;
    });
  }, [entries, filter, sortBy, sortAsc]);

  const highRiskCount = entries.filter(e => e.ownership > 90).length;
  const medRiskCount = entries.filter(e => e.ownership > 80 && e.ownership <= 90).length;

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  };

  const getRiskColor = (ownership: number) => {
    if (ownership > 90) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (ownership > 80) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  const getRiskLabel = (ownership: number) => {
    if (ownership > 90) return 'Critical';
    if (ownership > 80) return 'Warning';
    return 'Healthy';
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1c1c1c] bg-[#050505]">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-pink-400" />
          <h3 className="text-[13px] font-semibold text-[#ededed]">Bus Factor Analysis</h3>
        </div>
        <p className="text-[11px] text-[#52525b] leading-relaxed">
          Modules with high single-author ownership are at risk if that developer leaves.
        </p>

        {/* Risk Summary */}
        <div className="flex gap-3 mt-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[10px] font-mono text-red-400">{highRiskCount} Critical</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-mono text-amber-400">{medRiskCount} Warning</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-400">{entries.length - highRiskCount - medRiskCount} Healthy</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-[#1c1c1c]">
        <div className="flex items-center gap-2 h-7 px-2.5 bg-[#0a0a0a] border border-[#1c1c1c] rounded">
          <Search className="w-3 h-3 text-[#3f3f46]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, path, or author..."
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-[#ededed] placeholder:text-[#3f3f46]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[#52525b]">
            <Users className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[11px]">No ownership data available</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#050505] z-10">
              <tr className="text-[9px] uppercase tracking-wider text-[#52525b]">
                <th className="py-2 px-4 font-medium cursor-pointer hover:text-[#a1a1aa]" onClick={() => toggleSort('name')}>
                  Symbol <SortIcon col="name" />
                </th>
                <th className="py-2 px-4 font-medium cursor-pointer hover:text-[#a1a1aa]" onClick={() => toggleSort('ownership')}>
                  Ownership <SortIcon col="ownership" />
                </th>
                <th className="py-2 px-4 font-medium">Author</th>
                <th className="py-2 px-4 font-medium cursor-pointer hover:text-[#a1a1aa]" onClick={() => toggleSort('community')}>
                  Module <SortIcon col="community" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.node.id}
                  onClick={() => onFocusNode?.(entry.node.id)}
                  className="border-t border-[#1c1c1c]/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <td className="py-2 px-4">
                    <div className="text-[11px] font-medium text-[#ededed] truncate max-w-[180px]">{entry.node.properties.name}</div>
                    <div className="text-[9px] text-[#3f3f46] truncate max-w-[180px]">{entry.filePath}</div>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${getRiskColor(entry.ownership)}`}>
                      {entry.ownership}%
                      <span className="text-[8px] opacity-70">{getRiskLabel(entry.ownership)}</span>
                    </span>
                  </td>
                  <td className="py-2 px-4 text-[11px] text-[#a1a1aa] truncate max-w-[120px]">{entry.author}</td>
                  <td className="py-2 px-4 text-[10px] text-[#52525b] font-mono">{entry.community}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
