import { Search, Settings, HelpCircle, Sparkles, ChevronDown, Activity, FileText, Layers, Network, Flame, AlertTriangle, Cpu, GitFork, Users, Zap } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import type { RepoSummary } from '../services/server-connection';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GraphNode } from '../core/graph/types';
import { EmbeddingStatus } from './EmbeddingStatus';
import { generateCodeHealthReport } from '../lib/pdf-generator';

// Intelligence commands that differentiate CodeCortex from IDEs
const INTEL_COMMANDS = [
  { id: 'hotspots', label: '/hotspots', description: 'Files with highest change frequency', icon: Flame, color: 'text-orange-400' },
  { id: 'complexity', label: '/complexity', description: 'Most complex functions and classes', icon: Cpu, color: 'text-amber-400' },
  { id: 'violations', label: '/violations', description: 'Architectural violations in dependencies', icon: AlertTriangle, color: 'text-red-400' },
  { id: 'coupling', label: '/coupling', description: 'Most tightly coupled modules', icon: GitFork, color: 'text-sky-400' },
  { id: 'orphans', label: '/orphans', description: 'Unreferenced code (potential dead code)', icon: Zap, color: 'text-violet-400' },
  { id: 'bus-factor', label: '/bus-factor', description: 'Files owned >80% by single author', icon: Users, color: 'text-pink-400' },
];

const NODE_TYPE_COLORS: Record<string, string> = {
  Folder: '#6366f1',
  File: '#3b82f6',
  Function: '#10b981',
  Class: '#f59e0b',
  Method: '#14b8a6',
  Interface: '#ec4899',
  Variable: '#64748b',
  Import: '#475569',
  Type: '#a78bfa',
};

interface HeaderProps {
  onFocusNode?: (nodeId: string) => void;
  availableRepos?: RepoSummary[];
  onSwitchRepo?: (repoName: string) => void;
}

export const Header = ({ onFocusNode, availableRepos = [], onSwitchRepo }: HeaderProps) => {
  const {
    projectName,
    graph,
    openChatPanel,
    isRightPanelOpen,
    rightPanelTab,
    isHeatmapMode,
    setHeatmapMode,
    isDomainView,
    setDomainView,
    setSettingsPanelOpen,
    setHelpModalOpen,
    sendChatMessage,
    setRightPanelOpen,
  } = useAppState();

  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.relationships.length ?? 0;

  const searchResults = useMemo(() => {
    if (!graph || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    // If query starts with /, don't show node search (commands will show instead)
    if (query.startsWith('/')) return [];
    return graph.nodes
      .filter(node => node.properties.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [graph, searchQuery]);

  // Intelligence command matching
  const isCommandMode = searchQuery.startsWith('/');
  const matchingCommands = useMemo(() => {
    if (!isCommandMode) return [];
    const q = searchQuery.toLowerCase();
    return INTEL_COMMANDS.filter(c => c.label.startsWith(q) || c.id.includes(q.slice(1)));
  }, [searchQuery, isCommandMode]);

  // Execute an intelligence command and return matching nodes
  const executeCommand = useCallback((commandId: string) => {
    if (!graph) return;
    let resultNodes: GraphNode[] = [];

    switch (commandId) {
      case 'hotspots':
        resultNodes = [...graph.nodes]
          .filter(n => (n.properties.hotspotScore || 0) > 0)
          .sort((a, b) => (b.properties.hotspotScore || 0) - (a.properties.hotspotScore || 0))
          .slice(0, 15);
        break;
      case 'complexity':
        resultNodes = [...graph.nodes]
          .filter(n => (n.properties.complexityScore || 0) > 0)
          .sort((a, b) => (b.properties.complexityScore || 0) - (a.properties.complexityScore || 0))
          .slice(0, 15);
        break;
      case 'coupling':
        resultNodes = [...graph.nodes]
          .filter(n => ((n.properties.inDegree || 0) + (n.properties.outDegree || 0)) > 0)
          .sort((a, b) => ((b.properties.inDegree || 0) + (b.properties.outDegree || 0)) - ((a.properties.inDegree || 0) + (a.properties.outDegree || 0)))
          .slice(0, 15);
        break;
      case 'orphans': {
        const incoming = new Set(graph.relationships.filter(r => !r.hidden).map(r => r.targetId));
        resultNodes = graph.nodes
          .filter(n => !incoming.has(n.id) && !n.properties.hidden && n.label !== 'Folder' && n.label !== 'Project')
          .slice(0, 15);
        break;
      }
      case 'bus-factor':
        resultNodes = [...graph.nodes]
          .filter(n => (n.properties.ownership || 0) > 80)
          .sort((a, b) => (b.properties.ownership || 0) - (a.properties.ownership || 0))
          .slice(0, 15);
        break;
      case 'violations': {
        const violationEdges = graph.relationships.filter(r => r.violation);
        const violationNodeIds = new Set([...violationEdges.map(r => r.sourceId), ...violationEdges.map(r => r.targetId)]);
        resultNodes = graph.nodes.filter(n => violationNodeIds.has(n.id)).slice(0, 15);
        break;
      }
    }

    setCommandResults(resultNodes);
    setCommandLabel(commandId);
    if (resultNodes.length > 0 && onFocusNode) {
      onFocusNode(resultNodes[0].id);
    }
    setSearchQuery('');
    setIsSearchOpen(false);
  }, [graph, onFocusNode]);

  const [commandResults, setCommandResults] = useState<GraphNode[]>([]);
  const [commandLabel, setCommandLabel] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchOpen(false);
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) setIsRepoDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') { setIsSearchOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = isCommandMode ? matchingCommands.length : searchResults.length;
    if (!isSearchOpen || totalItems === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, totalItems - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCommandMode) {
        const cmd = matchingCommands[selectedIndex];
        if (cmd) executeCommand(cmd.id);
      } else {
        const s = searchResults[selectedIndex];
        if (s) handleSelectNode(s);
      }
    }
  };

  const handleSelectNode = (node: GraphNode) => {
    onFocusNode?.(node.id);
    setSearchQuery('');
    setIsSearchOpen(false);
    setSelectedIndex(0);
  };

  const handleGenerateArchitecture = async () => {
    setRightPanelOpen(true);
    const domainMap = new Map<string, string[]>();
    graph?.nodes.forEach(n => {
      if (n.label !== 'Community') {
        const commId = n.properties.community;
        if (commId !== undefined) {
          const k = String(commId);
          if (!domainMap.has(k)) domainMap.set(k, []);
          domainMap.get(k)!.push(n.properties.name);
        }
      }
    });
    let summary = "Codebase Domains/Subsystems:\\n\\n";
    Array.from(domainMap.entries()).slice(0, 15).forEach(([id, files]) => {
      summary += `Domain ${id}: ${files.length} files (e.g., ${files.slice(0, 5).join(', ')})\\n`;
    });
    await sendChatMessage(`Please generate an "Auto-Generated System Architecture Diagram" (C4 Context/Flowchart style) based on the current codebase domains.\n\n${summary}\n\nTasks:\n1. Infer semantic, high-level business names for these Domains.\n2. Generate a Mermaid.js \`graph TD\` showing how they piece together.\n3. Provide a 1-paragraph Executive Summary.`);
  };

  return (
    <header className="flex items-center h-12 px-4 bg-[#000000] border-b border-[#1c1c1c] z-50 gap-3 shrink-0 select-none">

      {/* ── LEFT: Brand + Repo ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Logo mark */}
        <div className="w-6 h-6 rounded-[4px] bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white text-[10px] font-bold tracking-tighter shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          ◈
        </div>
        <span className="font-semibold text-[13px] tracking-tight text-[#ededed]">CodeCortex</span>

        {projectName && (
          <div className="relative" ref={repoDropdownRef}>
            <button
              onClick={() => availableRepos.length >= 2 && setIsRepoDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 h-6 px-2 bg-[#111] border border-[#222] rounded-[4px] text-[12px] text-[#a1a1aa] hover:bg-[#161616] hover:text-[#ededed] transition-all"
            >
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
              <span className="truncate max-w-[150px] font-medium">{projectName}</span>
              {availableRepos.length >= 2 && (
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isRepoDropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {isRepoDropdownOpen && availableRepos.length >= 2 && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-[#0d0d0d] border border-[#222] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden z-50 py-1">
                {availableRepos.map((repo) => {
                  const isCurrent = repo.name === projectName;
                  return (
                    <button
                      key={repo.name}
                      onClick={() => { if (!isCurrent && onSwitchRepo) onSwitchRepo(repo.name); setIsRepoDropdownOpen(false); }}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${isCurrent ? 'bg-white/[0.04] text-[#ededed]' : 'hover:bg-white/[0.03] text-[#a1a1aa]'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-emerald-500' : 'bg-[#333]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium truncate">{repo.name}</div>
                        <div className="text-[10px] text-[#52525b]">{repo.stats?.nodes ?? '?'} nodes</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SEPARATOR ── */}
      <div className="w-px h-4 bg-[#222] shrink-0" />

      {/* ── CENTER: Cmd+K Command Bar ── */}
      <div className="flex-1 min-w-0 relative" ref={searchRef}>
        <div
          onClick={() => { inputRef.current?.focus(); setIsSearchOpen(true); }}
          className={`flex items-center gap-2 h-8 px-3 rounded-[6px] border cursor-text transition-all duration-150 ${
            isSearchOpen
              ? 'bg-[#050505] border-[#3b82f6]/50 ring-2 ring-[#3b82f6]/10'
              : 'bg-[#0d0d0d] border-[#1c1c1c] hover:border-[#303030]'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-[#3f3f46] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={graph ? `Search nodes or type / for commands...` : 'Load a repository to begin...'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); setSelectedIndex(0); }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-[#ededed] placeholder:text-[#3f3f46]"
          />
          <kbd className="shrink-0 h-5 px-1.5 bg-[#0d0d0d] border border-[#222] rounded text-[10px] text-[#3f3f46] font-mono leading-none flex items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            ⌘K
          </kbd>
        </div>

        {/* Results / Commands Dropdown */}
        {isSearchOpen && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d0d0d] border border-[#222] rounded-lg shadow-[0_20px_64px_rgba(0,0,0,0.95)] overflow-hidden z-50">
            {isCommandMode ? (
              /* ── COMMAND MODE ── */
              matchingCommands.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-[#52525b]">No matching commands</p>
              ) : (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] text-[#3f3f46] uppercase tracking-[0.15em] font-medium">Intelligence Commands</p>
                  <div className="pb-1">
                    {matchingCommands.map((cmd, index) => {
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd.id)}
                          className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                            index === selectedIndex ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${cmd.color}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-mono font-medium text-[#ededed]">{cmd.label}</span>
                            <span className="ml-2 text-[11px] text-[#52525b]">{cmd.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#1c1c1c] px-3 py-1.5 flex items-center gap-3 text-[10px] text-[#3f3f46]">
                    <span><kbd className="font-mono">↵</kbd> execute</span>
                    <span><kbd className="font-mono">esc</kbd> close</span>
                  </div>
                </>
              )
            ) : (
              /* ── NODE SEARCH MODE ── */
              searchResults.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-[#52525b]">No results · type <kbd className="font-mono text-[#3b82f6]">/</kbd> for commands</p>
              ) : (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] text-[#3f3f46] uppercase tracking-[0.15em] font-medium">Nodes</p>
                  <div className="max-h-64 overflow-y-auto pb-1 scrollbar-thin">
                    {searchResults.map((node, index) => (
                      <button
                        key={node.id}
                        onClick={() => handleSelectNode(node)}
                        className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                          index === selectedIndex ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NODE_TYPE_COLORS[node.label] || '#3f3f46' }} />
                        <span className="flex-1 truncate text-[13px] font-medium text-[#ededed]">{node.properties.name}</span>
                        <span className="shrink-0 text-[10px] text-[#52525b] font-mono px-1.5 py-0.5 bg-[#141414] border border-[#1c1c1c] rounded">{node.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[#1c1c1c] px-3 py-1.5 flex items-center gap-3 text-[10px] text-[#3f3f46]">
                    <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                    <span><kbd className="font-mono">↵</kbd> focus</span>
                    <span><kbd className="font-mono">/</kbd> commands</span>
                    <span><kbd className="font-mono">esc</kbd> close</span>
                  </div>
                </>
              )
            )}
          </div>
        )}

        {/* ── Command Results Panel (inline, below search) ── */}
        {!isSearchOpen && commandResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d0d0d] border border-[#222] rounded-lg shadow-[0_20px_64px_rgba(0,0,0,0.95)] overflow-hidden z-50">
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <p className="text-[10px] text-[#3f3f46] uppercase tracking-[0.15em] font-medium">/{commandLabel} — {commandResults.length} results</p>
              <button onClick={() => setCommandResults([])} className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] transition-colors">✕ close</button>
            </div>
            <div className="max-h-72 overflow-y-auto pb-1 scrollbar-thin">
              {commandResults.map((node) => (
                <button
                  key={node.id}
                  onClick={() => { onFocusNode?.(node.id); }}
                  className="w-full px-3 py-2 flex items-center gap-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: NODE_TYPE_COLORS[node.label] || '#3f3f46' }} />
                  <span className="flex-1 truncate text-[13px] font-medium text-[#ededed]">{node.properties.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {node.properties.complexityScore !== undefined && (
                      <span className={`text-[10px] font-mono ${(node.properties.complexityScore || 0) > 30 ? 'text-amber-400' : 'text-[#52525b]'}`}>
                        C:{node.properties.complexityScore}
                      </span>
                    )}
                    {node.properties.hotspotScore !== undefined && (
                      <span className={`text-[10px] font-mono ${(node.properties.hotspotScore || 0) > 5 ? 'text-orange-400' : 'text-[#52525b]'}`}>
                        H:{node.properties.hotspotScore}
                      </span>
                    )}
                    <span className="text-[10px] text-[#52525b] font-mono px-1.5 py-0.5 bg-[#141414] border border-[#1c1c1c] rounded">{node.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SEPARATOR ── */}
      <div className="w-px h-4 bg-[#222] shrink-0" />

      {/* ── RIGHT: Compact Icon Toolbar ── */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Stats */}
        {graph && (
          <div className="flex items-center gap-3 mr-2 text-[11px] text-[#3f3f46] font-mono">
            <span className="text-[#52525b]">{nodeCount}<span className="ml-1 text-[#2a2a2a]">n</span></span>
            <span className="text-[#52525b]">{edgeCount}<span className="ml-1 text-[#2a2a2a]">e</span></span>
          </div>
        )}

        <IconBtn onClick={() => setDomainView(!isDomainView)} active={isDomainView} title="Domain Map">
          <Layers className="w-4 h-4" />
        </IconBtn>

        {graph && (
          <button
            onClick={handleGenerateArchitecture}
            className="flex items-center gap-1.5 h-7 px-2 rounded text-[12px] text-[#a1a1aa] hover:text-[#ededed] hover:bg-white/[0.04] transition-colors"
            title="Generate System Architecture"
          >
            <Network className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Arch</span>
          </button>
        )}

        <IconBtn onClick={() => setHeatmapMode(!isHeatmapMode)} active={isHeatmapMode} title="Heatmap" activeClass="text-amber-400 bg-amber-400/10">
          <Activity className="w-4 h-4" />
        </IconBtn>

        {graph && (
          <IconBtn onClick={() => generateCodeHealthReport(graph, projectName)} title="PDF Report">
            <FileText className="w-4 h-4" />
          </IconBtn>
        )}

        <EmbeddingStatus />

        <IconBtn onClick={() => setSettingsPanelOpen(true)} title="Settings">
          <Settings className="w-4 h-4" />
        </IconBtn>

        <IconBtn onClick={() => setHelpModalOpen(true)} title="Help">
          <HelpCircle className="w-4 h-4" />
        </IconBtn>

        {/* Primary CTA */}
        <button
          onClick={openChatPanel}
          className={`flex items-center gap-1.5 h-7 px-3 rounded-[5px] text-[12px] font-medium transition-all ml-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
            isRightPanelOpen && rightPanelTab === 'chat'
              ? 'bg-[#3b82f6] text-white'
              : 'bg-[#141414] border border-[#222] text-[#ededed] hover:bg-[#1c1c1c] hover:border-[#2a2a2a]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Cortex AI</span>
        </button>
      </div>
    </header>
  );
};

// Reusable icon button with Linear-style active state
const IconBtn = ({
  children,
  onClick,
  title,
  active = false,
  activeClass = 'text-[#ededed] bg-white/[0.08]',
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  activeClass?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-7 h-7 flex items-center justify-center rounded transition-all duration-100 ${
      active ? activeClass : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-white/[0.04]'
    }`}
  >
    {children}
  </button>
);
