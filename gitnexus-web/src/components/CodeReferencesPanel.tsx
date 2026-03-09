import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code, PanelLeftClose, PanelLeft, Trash2, X, Target, FileCode, Sparkles, MousePointerClick, Layers } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppState } from '../hooks/useAppState';
import { NODE_COLORS } from '../lib/constants';
import { traceDataFlow } from '../core/analysis/taint-analysis';
import { Share2, RotateCcw } from 'lucide-react';

// Match the code theme used elsewhere in the app
const customTheme = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: '#0a0a10',
    margin: 0,
    padding: '12px 0',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    background: 'transparent',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
};

export interface CodeReferencesPanelProps {
  onFocusNode: (nodeId: string) => void;
}

export const CodeReferencesPanel = ({ onFocusNode }: CodeReferencesPanelProps) => {
  const {
    graph,
    fileContents,
    selectedNode,
    codeReferences,
    removeCodeReference,
    clearCodeReferences,
    setSelectedNode,
    codeReferenceFocus,
    sendChatMessage,
    setRightPanelOpen,
    taintedNodeIds,
    setTaintHighlights,
    clearTaintHighlights,
  } = useAppState();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [glowRefId, setGlowRefId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const refCardEls = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const glowTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (glowTimerRef.current) {
        window.clearTimeout(glowTimerRef.current);
        glowTimerRef.current = null;
      }
    };
  }, []);

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem('gitnexus.codePanelWidth');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (!Number.isFinite(parsed)) return 560; // increased default
      return Math.max(420, Math.min(parsed, 900));
    } catch {
      return 560;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('gitnexus.codePanelWidth', String(panelWidth));
    } catch {
      // ignore
    }
  }, [panelWidth]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const state = resizeRef.current;
      if (!state) return;
      const delta = ev.clientX - state.startX;
      const next = Math.max(420, Math.min(state.startWidth + delta, 900));
      setPanelWidth(next);
    };

    const onUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  const aiReferences = useMemo(() => codeReferences.filter(r => r.source === 'ai'), [codeReferences]);

  // When the user clicks a citation badge in chat, focus the corresponding snippet card:
  // - expand the panel if collapsed
  // - smooth-scroll the card into view
  // - briefly glow it for discoverability
  useEffect(() => {
    if (!codeReferenceFocus) return;

    // Ensure panel is expanded
    setIsCollapsed(false);

    const { filePath, startLine, endLine } = codeReferenceFocus;
    const target =
      aiReferences.find(r =>
        r.filePath === filePath &&
        r.startLine === startLine &&
        r.endLine === endLine
      ) ??
      aiReferences.find(r => r.filePath === filePath);

    if (!target) return;

    // Double rAF: wait for collapse state + list DOM to render.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = refCardEls.current.get(target.id);
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setGlowRefId(target.id);

        if (glowTimerRef.current) {
          window.clearTimeout(glowTimerRef.current);
        }
        glowTimerRef.current = window.setTimeout(() => {
          setGlowRefId((prev) => (prev === target.id ? null : prev));
          glowTimerRef.current = null;
        }, 1200);
      });
    });
  }, [codeReferenceFocus?.ts, aiReferences]);

  const refsWithSnippets = useMemo(() => {
    return aiReferences.map((ref) => {
      const content = fileContents.get(ref.filePath);
      if (!content) {
        return { ref, content: null as string | null, start: 0, end: 0, highlightStart: 0, highlightEnd: 0, totalLines: 0 };
      }

      const lines = content.split('\n');
      const totalLines = lines.length;

      const startLine = ref.startLine ?? 0;
      const endLine = ref.endLine ?? startLine;

      const contextBefore = 3;
      const contextAfter = 20;
      const start = Math.max(0, startLine - contextBefore);
      const end = Math.min(totalLines - 1, endLine + contextAfter);

      return {
        ref,
        content: lines.slice(start, end + 1).join('\n'),
        start,
        end,
        highlightStart: Math.max(0, startLine - start),
        highlightEnd: Math.max(0, endLine - start),
        totalLines,
      };
    });
  }, [aiReferences, fileContents]);

  const selectedFilePath = selectedNode?.properties?.filePath;
  const selectedFileContent = selectedFilePath ? fileContents.get(selectedFilePath) : undefined;
  const selectedIsFile = selectedNode?.label === 'File' && !!selectedFilePath;
  const selectedIsDomain = selectedNode?.label === 'Community';
  const showSelectedViewer = !!selectedNode && (!!selectedFilePath || selectedIsDomain);
  const showCitations = aiReferences.length > 0;

  if (isCollapsed) {
    return (
      <aside className="h-full w-12 bg-surface border-r border-border-subtle flex flex-col items-center py-3 gap-2 flex-shrink-0">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 text-text-secondary hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
          title="Expand Code Panel"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <div className="w-6 h-px bg-border-subtle my-1" />
        {showSelectedViewer && (
          <div className="text-[9px] text-amber-400 rotate-90 whitespace-nowrap font-medium tracking-wide">
            SELECTED
          </div>
        )}
        {showCitations && (
          <div className="text-[9px] text-cyan-400 rotate-90 whitespace-nowrap font-medium tracking-wide mt-4">
            AI • {aiReferences.length}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      ref={(el) => { panelRef.current = el; }}
      className="h-full bg-surface/95 backdrop-blur-md border-r border-border-subtle flex flex-col animate-slide-in relative shadow-2xl"
      style={{ width: panelWidth }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-cyan-500/25 transition-colors"
        title="Drag to resize"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle bg-gradient-to-r from-elevated/60 to-surface/60">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-text-primary">Code Inspector</span>
        </div>
        <div className="flex items-center gap-1.5">
          {showCitations && (
            <button
              onClick={() => clearCodeReferences()}
              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Clear AI citations"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-hover rounded transition-colors"
            title="Collapse Panel"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Top: Selected file viewer (when a node is selected) */}
        {showSelectedViewer && (
          <div className={`${showCitations ? 'h-[42%]' : 'flex-1'} min-h-0 flex flex-col`}>
            <div className="px-3 py-2 bg-gradient-to-r from-amber-500/8 to-orange-500/5 border-b border-amber-500/20 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/15 rounded-md border border-amber-500/25">
                <MousePointerClick className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wide">Selected</span>
              </div>
              <FileCode className="w-3.5 h-3.5 text-amber-400/70 ml-1" />
              <span className="text-xs text-text-primary font-mono truncate flex-1">
                {selectedNode?.properties?.filePath?.split('/').pop() ?? selectedNode?.properties?.name}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-text-muted hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* NEW: Health Metrics Section */}
            {(selectedNode?.properties.complexityScore !== undefined || selectedNode?.properties.hotspotScore !== undefined) && (
              <div className="px-3 py-2 bg-elevated/40 border-b border-border-subtle flex flex-col gap-2">

                {/* Composite Risk Score */}
                <div className="flex items-center justify-between">
                  {(() => {
                    const complexity = selectedNode.properties.complexityScore || 0;
                    const hotspot = selectedNode.properties.hotspotScore || 0;
                    // Formula: (Complexity * 1.5) + (Hotspot * 2.5), capped at 100
                    const riskScore = Math.min(100, Math.round((complexity * 1.5) + (hotspot * 2.5)));

                    let riskColor = 'text-emerald-400';
                    let riskLabel = 'Low Risk';
                    if (riskScore > 75) { riskColor = 'text-rose-500'; riskLabel = 'Critical Risk'; }
                    else if (riskScore > 50) { riskColor = 'text-orange-500'; riskLabel = 'High Risk'; }
                    else if (riskScore > 25) { riskColor = 'text-amber-400'; riskLabel = 'Moderate Risk'; }

                    return (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted font-semibold uppercase tracking-widest text-[10px]">Overall Risk</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-lg font-black tracking-tight ${riskColor}`}>{riskScore}</span>
                            <span className={`text-[10px] uppercase font-bold ${riskColor} opacity-80`}>{riskLabel}</span>
                          </div>
                        </div>

                        {riskScore > 50 && (
                          <div className="flex items-center gap-2">
                            {taintedNodeIds.size > 0 ? (
                              <button
                                onClick={() => clearTaintHighlights()}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-border-subtle hover:bg-hover text-text-muted rounded-lg transition-all active:scale-95"
                                title="Clear Trace"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Clear Trace</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  const result = traceDataFlow(graph!, selectedNode.id);
                                  setTaintHighlights(result.pathNodeIds, result.pathEdgeIds);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400 rounded-lg transition-all active:scale-95 group"
                                title="Follow the data flow from this node"
                              >
                                <Share2 className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Trace Flow</span>
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                setRightPanelOpen(true);
                                await sendChatMessage(`Analyze the architectural hotspot in \`${selectedNode.properties.filePath || selectedNode.properties.name}\`.

Metrics:
- Complexity: ${complexity}
- Hotspot Score: ${hotspot}
- In-degree: ${selectedNode.properties.inDegree || 0}
- Out-degree: ${selectedNode.properties.outDegree || 0}

Please draft a detailed Refactoring Plan to reduce this risk. Consider file splitting, extracting business logic into services, and decoupling dependencies.`);
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all active:scale-95 group"
                            >
                              <Sparkles className="w-3.5 h-3.5 group-hover:animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">Draft Refactor</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Sub-metrics */}
                <div className="flex items-center gap-4 text-[10px] bg-surface/50 p-1.5 rounded border border-border-subtle">
                  {selectedNode.properties.complexityScore !== undefined && (
                    <div className="flex items-center gap-1.5" title="Cyclomatic Complexity + Line Count">
                      <span className="text-text-muted uppercase tracking-tight">Complexity</span>
                      <span className={`font-mono font-bold ${selectedNode.properties.complexityScore > 30 ? 'text-orange-400' : 'text-text-primary'}`}>
                        {selectedNode.properties.complexityScore}
                      </span>
                    </div>
                  )}
                  {selectedNode.properties.hotspotScore !== undefined && (
                    <div className="flex items-center gap-1.5" title="Centrality (Weight of incoming/outgoing calls)">
                      <span className="text-text-muted uppercase tracking-tight">Hotspot</span>
                      <span className={`font-mono font-bold ${selectedNode.properties.hotspotScore > 15 ? 'text-rose-400' : 'text-text-primary'}`}>
                        {selectedNode.properties.hotspotScore}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 ml-auto text-text-muted opacity-80 font-mono">
                    <span>In:{selectedNode.properties.inDegree || 0}</span>
                    <span>Out:{selectedNode.properties.outDegree || 0}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
              {selectedIsDomain && graph ? (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-semibold text-text-primary">Domain Composition</h3>
                  </div>
                  <div className="bg-elevated/40 border border-border-subtle rounded-lg p-3">
                    <p className="text-sm text-text-secondary mb-3">
                      This domain contains {selectedNode?.properties.mass || 0} files tightly coupled by business logic.
                    </p>

                    <button
                      onClick={async () => {
                        setRightPanelOpen(true);

                        // Gather all the filenames to send to the AI
                        const domainFiles = graph.nodes
                          .filter(n => n.properties.community === selectedNode?.properties.community && n.label !== 'Community')
                          .map(n => n.properties.name)
                          .join(', ');

                        await sendChatMessage(`Please generate "Living Domain Documentation" for this architectural domain (Domain ${selectedNode?.properties.community}).

Files in this domain:
\`\`\`text
${domainFiles}
\`\`\`

Tasks:
1. Infer what business subsystem or module this represents (e.g., Auth, Payments, User Mgmt).
2. Provide a high-level summary of the domain's responsibility.
3. Generate a Mermaid sequence or flowchart diagram demonstrating how you think these files interact based on their names.
4. Suggest a proper name for this Domain.`);
                      }}
                      className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/30 text-indigo-300 rounded-lg transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Analyze Domain</span>
                    </button>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 scrollbar-thin pr-2">
                      {/* Find all files in this domain */}
                      {graph.nodes
                        .filter(n => n.properties.community === selectedNode?.properties.community && n.label !== 'Community')
                        .slice(0, 50) // Limit to 50 for performance
                        .map(node => (
                          <div key={node.id} className="flex items-center gap-2 text-xs py-1.5 px-2 hover:bg-hover rounded cursor-pointer transition-colors" onClick={() => onFocusNode(node.id)}>
                            <FileCode className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                            <span className="text-text-primary truncate">{node.properties.name}</span>
                            <span className="text-text-muted text-[10px] ml-auto bg-surface px-1.5 py-0.5 rounded border border-border-subtle">{node.label}</span>
                          </div>
                        ))}
                      {(selectedNode?.properties.mass as number || 0) > 50 && (
                        <div className="text-xs text-text-muted italic text-center pt-2 border-t border-border-subtle mt-2">
                          + {(selectedNode?.properties.mass as number || 0) - 50} more files
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedFileContent ? (
                <SyntaxHighlighter
                  language={
                    selectedFilePath?.endsWith('.py') ? 'python' :
                      selectedFilePath?.endsWith('.js') || selectedFilePath?.endsWith('.jsx') ? 'javascript' :
                        selectedFilePath?.endsWith('.ts') || selectedFilePath?.endsWith('.tsx') ? 'typescript' :
                          'text'
                  }
                  style={customTheme as any}
                  showLineNumbers
                  startingLineNumber={1}
                  lineNumberStyle={{
                    minWidth: '3em',
                    paddingRight: '1em',
                    color: '#5a5a70',
                    textAlign: 'right',
                    userSelect: 'none',
                  }}
                  lineProps={(lineNumber) => {
                    const startLine = selectedNode?.properties?.startLine;
                    const endLine = selectedNode?.properties?.endLine ?? startLine;
                    const isHighlighted =
                      typeof startLine === 'number' &&
                      lineNumber >= startLine + 1 &&
                      lineNumber <= (endLine ?? startLine) + 1;
                    return {
                      style: {
                        display: 'block',
                        backgroundColor: isHighlighted ? 'rgba(6, 182, 212, 0.14)' : 'transparent',
                        borderLeft: isHighlighted ? '3px solid #06b6d4' : '3px solid transparent',
                        paddingLeft: '12px',
                        paddingRight: '16px',
                      },
                    };
                  }}
                  wrapLines
                >
                  {selectedFileContent}
                </SyntaxHighlighter>
              ) : (
                <div className="px-3 py-3 text-sm text-text-muted">
                  {selectedIsFile ? (
                    <>Code not available in memory for <span className="font-mono">{selectedFilePath}</span></>
                  ) : (
                    <>Select a file node to preview its contents.</>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider between Selected viewer and AI refs (more visible) */}
        {showSelectedViewer && showCitations && (
          <div className="h-1.5 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
        )}

        {/* Bottom: AI citations list */}
        {showCitations && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* AI Citations Section Header */}
            <div className="px-3 py-2 bg-gradient-to-r from-cyan-500/8 to-teal-500/5 border-b border-cyan-500/20 flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/15 rounded-md border border-cyan-500/25">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-cyan-300 font-semibold uppercase tracking-wide">AI Citations</span>
              </div>
              <span className="text-xs text-text-muted ml-1">{aiReferences.length} reference{aiReferences.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-3">
              {refsWithSnippets.map(({ ref, content, start, highlightStart, highlightEnd, totalLines }) => {
                const nodeColor = ref.label ? (NODE_COLORS as any)[ref.label] || '#6b7280' : '#6b7280';
                const hasRange = typeof ref.startLine === 'number';
                const startDisplay = hasRange ? (ref.startLine ?? 0) + 1 : undefined;
                const endDisplay = hasRange ? (ref.endLine ?? ref.startLine ?? 0) + 1 : undefined;
                const language =
                  ref.filePath.endsWith('.py') ? 'python' :
                    ref.filePath.endsWith('.js') || ref.filePath.endsWith('.jsx') ? 'javascript' :
                      ref.filePath.endsWith('.ts') || ref.filePath.endsWith('.tsx') ? 'typescript' :
                        'text';

                const isGlowing = glowRefId === ref.id;

                return (
                  <div
                    key={ref.id}
                    ref={(el) => { refCardEls.current.set(ref.id, el); }}
                    className={[
                      'bg-elevated border border-border-subtle rounded-xl overflow-hidden transition-all',
                      isGlowing ? 'ring-2 ring-cyan-300/70 shadow-[0_0_0_6px_rgba(34,211,238,0.14)] animate-pulse' : '',
                    ].join(' ')}
                  >
                    <div className="px-3 py-2 border-b border-border-subtle bg-surface/40 flex items-start gap-2">
                      <span
                        className="mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                        style={{ backgroundColor: nodeColor, color: '#06060a' }}
                        title={ref.label ?? 'Code'}
                      >
                        {ref.label ?? 'Code'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-text-primary font-medium truncate">
                          {ref.name ?? ref.filePath.split('/').pop() ?? ref.filePath}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono truncate">
                          {ref.filePath}
                          {startDisplay !== undefined && (
                            <span className="text-text-secondary">
                              {' '}
                              • L{startDisplay}
                              {endDisplay !== startDisplay ? `–${endDisplay}` : ''}
                            </span>
                          )}
                          {totalLines > 0 && <span className="text-text-muted"> • {totalLines} lines</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {ref.nodeId && (
                          <button
                            onClick={() => {
                              const nodeId = ref.nodeId!;
                              // Sync selection + focus graph
                              if (graph) {
                                const node = graph.nodes.find((n) => n.id === nodeId);
                                if (node) setSelectedNode(node);
                              }
                              onFocusNode(nodeId);
                            }}
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-hover rounded transition-colors"
                            title="Focus in graph"
                          >
                            <Target className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => removeCodeReference(ref.id)}
                          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-hover rounded transition-colors"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      {content ? (
                        <SyntaxHighlighter
                          language={language}
                          style={customTheme as any}
                          showLineNumbers
                          startingLineNumber={start + 1}
                          lineNumberStyle={{
                            minWidth: '3em',
                            paddingRight: '1em',
                            color: '#5a5a70',
                            textAlign: 'right',
                            userSelect: 'none',
                          }}
                          lineProps={(lineNumber) => {
                            const isHighlighted =
                              hasRange &&
                              lineNumber >= start + highlightStart + 1 &&
                              lineNumber <= start + highlightEnd + 1;
                            return {
                              style: {
                                display: 'block',
                                backgroundColor: isHighlighted ? 'rgba(6, 182, 212, 0.14)' : 'transparent',
                                borderLeft: isHighlighted ? '3px solid #06b6d4' : '3px solid transparent',
                                paddingLeft: '12px',
                                paddingRight: '16px',
                              },
                            };
                          }}
                          wrapLines
                        >
                          {content}
                        </SyntaxHighlighter>
                      ) : (
                        <div className="px-3 py-3 text-sm text-text-muted">
                          Code not available in memory for <span className="font-mono">{ref.filePath}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
