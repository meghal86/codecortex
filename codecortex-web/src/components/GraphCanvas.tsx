import { useEffect, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Focus, RotateCcw, Play, Pause, Lightbulb, LightbulbOff, AlertTriangle } from 'lucide-react';
import { useSigma } from '../hooks/useSigma';
import { useAppState } from '../hooks/useAppState';
import { knowledgeGraphToGraphology, knowledgeGraphToDomainGraphology, filterGraphByDepth, SigmaNodeAttributes, SigmaEdgeAttributes } from '../lib/graph-adapter';
import { GraphNode } from '../core/graph/types';
import { QueryFAB } from './QueryFAB';
import Graph from 'graphology';
import { calculateBlastRadius, BlastRadiusResult } from '../lib/blast-radius';

export interface GraphCanvasHandle {
  focusNode: (nodeId: string) => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle>((_, ref) => {
  const {
    graph,
    setSelectedNode,
    selectedNode: appSelectedNode,
    visibleLabels,
    visibleEdgeTypes,
    openCodePanel,
    depthFilter,
    highlightedNodeIds,
    setHighlightedNodeIds,
    aiCitationHighlightedNodeIds,
    aiToolHighlightedNodeIds,
    blastRadiusNodeIds,
    isAIHighlightsEnabled,
    toggleAIHighlights,
    animatedNodes,
    isHeatmapMode,
    isolateBlastRadius,
    taintedNodeIds,
    taintedEdgeIds,
    isDomainView,
  } = useAppState();
  const [hoveredNodeName, setHoveredNodeName] = useState<string | null>(null);
  const [blastResult, setBlastResult] = useState<BlastRadiusResult | null>(null);
  const [blastCommunities, setBlastCommunities] = useState(0);

  const effectiveHighlightedNodeIds = useMemo(() => {
    if (!isAIHighlightsEnabled) return highlightedNodeIds;
    const next = new Set(highlightedNodeIds);
    for (const id of aiCitationHighlightedNodeIds) next.add(id);
    for (const id of aiToolHighlightedNodeIds) next.add(id);
    // Note: blast radius nodes are handled separately with red color
    return next;
  }, [highlightedNodeIds, aiCitationHighlightedNodeIds, aiToolHighlightedNodeIds, isAIHighlightsEnabled]);

  // Blast radius nodes (only when AI highlights enabled)
  const effectiveBlastRadiusNodeIds = useMemo(() => {
    if (!isAIHighlightsEnabled) return new Set<string>();
    return blastRadiusNodeIds;
  }, [blastRadiusNodeIds, isAIHighlightsEnabled]);

  // Animated nodes (only when AI highlights enabled)
  const effectiveAnimatedNodes = useMemo(() => {
    if (!isAIHighlightsEnabled) return new Map();
    return animatedNodes;
  }, [animatedNodes, isAIHighlightsEnabled]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!graph) return;

    // Check if it's a domain node
    if (nodeId.startsWith('domain_')) {
      const communityId = parseInt(nodeId.replace('domain_', ''), 10);
      // Create a synthetic node for the domain so the property panel can render it
      const domainNode: GraphNode = {
        id: nodeId,
        label: 'Community',
        properties: {
          name: `Domain ${communityId}`,
          filePath: '',
          community: communityId
        }
      };
      setSelectedNode(domainNode);
      openCodePanel();
      return;
    }

    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      openCodePanel();

      // Auto-compute blast radius on click
      const result = calculateBlastRadius(graph, [nodeId], 3);
      setBlastResult(result);

      // Count affected subsystems
      const communities = new Set<string | number>();
      result.affectedNodeIds.forEach(id => {
        const n = graph.nodes.find(nd => nd.id === id);
        if (n?.properties.community !== undefined) communities.add(n.properties.community);
      });
      setBlastCommunities(communities.size);
    }
  }, [graph, setSelectedNode, openCodePanel]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    if (!nodeId || !graph) {
      setHoveredNodeName(null);
      return;
    }
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      setHoveredNodeName(node.properties.name);
    }
  }, [graph]);

  const handleStageClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const {
    containerRef,
    sigmaRef,
    setGraph: setSigmaGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    isLayoutRunning,
    startLayout,
    stopLayout,
    selectedNode: sigmaSelectedNode,
    setSelectedNode: setSigmaSelectedNode,
  } = useSigma({
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onStageClick: handleStageClick,
    highlightedNodeIds: effectiveHighlightedNodeIds,
    blastRadiusNodeIds: effectiveBlastRadiusNodeIds,
    isolateBlastRadius,
    animatedNodes: effectiveAnimatedNodes,
    visibleEdgeTypes,
    taintedNodeIds,
    taintedEdgeIds,
  });

  // Expose focusNode to parent via ref
  useImperativeHandle(ref, () => ({
    focusNode: (nodeId: string) => {
      // Also update app state so the selection syncs properly
      if (graph) {
        const node = graph.nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
          openCodePanel();
        }
      }
      focusNode(nodeId);
    }
  }), [focusNode, graph, setSelectedNode, openCodePanel]);

  // Update Sigma graph when KnowledgeGraph or view mode changes
  useEffect(() => {
    if (!graph) return;

    // Build communityMemberships map from MEMBER_OF relationships
    // This is needed for coloring the File Map, and grouping the Domain Map
    const communityMemberships = new Map<string, number>();
    graph.nodes.forEach(node => {
      if (node.properties.community !== undefined) {
        communityMemberships.set(node.id, node.properties.community as number);
      }
    });

    let sigmaGraph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;

    if (isDomainView) {
      // Render the high-level Domain Map
      sigmaGraph = knowledgeGraphToDomainGraphology(graph, communityMemberships);
    } else {
      // Render the standard File Map
      sigmaGraph = knowledgeGraphToGraphology(graph, communityMemberships);
    }

    setSigmaGraph(sigmaGraph);
  }, [graph, isDomainView, setSigmaGraph]);

  // Update node visibility when filters change
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    const sigmaGraph = sigma.getGraph() as Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;
    if (sigmaGraph.order === 0) return; // Don't filter empty graph

    filterGraphByDepth(sigmaGraph, appSelectedNode?.id || null, depthFilter, visibleLabels);
    sigma.refresh();
  }, [visibleLabels, depthFilter, appSelectedNode, sigmaRef]);

  // Sync app selected node with sigma
  useEffect(() => {
    if (appSelectedNode) {
      setSigmaSelectedNode(appSelectedNode.id);
    } else {
      setSigmaSelectedNode(null);
    }
  }, [appSelectedNode, setSigmaSelectedNode]);

  // Focus on selected node
  const handleFocusSelected = useCallback(() => {
    if (appSelectedNode) {
      focusNode(appSelectedNode.id);
    }
  }, [appSelectedNode, focusNode]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNode(null);
    setSigmaSelectedNode(null);
    setBlastResult(null);
    resetZoom();
  }, [setSelectedNode, setSigmaSelectedNode, resetZoom]);

  return (
    <div className="relative w-full h-full bg-void">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.03) 0%, transparent 70%),
              linear-gradient(to bottom, #06060a, #0a0a10)
            `
          }}
        />
      </div>

      {/* Sigma container */}
      <div
        ref={containerRef}
        className="sigma-container w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Hovered node tooltip - only show when NOT selected */}
      {hoveredNodeName && !sigmaSelectedNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-elevated/95 border border-border-subtle rounded-lg backdrop-blur-sm z-20 pointer-events-none animate-fade-in">
          <span className="font-mono text-sm text-text-primary">{hoveredNodeName}</span>
        </div>
      )}

      {/* Selection + Blast Radius Impact Card */}
      {sigmaSelectedNode && appSelectedNode && blastResult && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 bg-[#0d0d0d]/95 border border-[#222] rounded-lg backdrop-blur-sm z-20 shadow-[0_12px_40px_rgba(0,0,0,0.7)]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {/* Node info */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#3b82f6] rounded-full" />
            <span className="font-mono text-[13px] font-medium text-[#ededed]">{appSelectedNode.properties.name}</span>
            <span className="text-[10px] text-[#52525b] font-mono px-1.5 py-0.5 bg-[#141414] border border-[#1c1c1c] rounded">{appSelectedNode.label}</span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-[#222]" />

          {/* Blast Radius Data — the killer feature */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <span className={`block text-[16px] font-bold font-mono ${
                blastResult.affectedNodeIds.size > 20 ? 'text-red-400' : blastResult.affectedNodeIds.size > 10 ? 'text-amber-400' : 'text-[#ededed]'
              }`}>
                {blastResult.affectedNodeIds.size}
              </span>
              <span className="text-[9px] text-[#52525b] uppercase tracking-wider">affected</span>
            </div>
            <div className="text-center">
              <span className={`block text-[16px] font-bold font-mono ${
                blastCommunities > 3 ? 'text-red-400' : 'text-[#ededed]'
              }`}>
                {blastCommunities}
              </span>
              <span className="text-[9px] text-[#52525b] uppercase tracking-wider">subsystems</span>
            </div>
            <div className="text-center">
              <span className={`block text-[16px] font-bold font-mono ${
                blastResult.riskScore > 60 ? 'text-red-400' : blastResult.riskScore > 30 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {blastResult.riskScore}
              </span>
              <span className="text-[9px] text-[#52525b] uppercase tracking-wider">risk</span>
            </div>
          </div>

          {/* Risk Label */}
          {blastResult.riskScore > 40 && (
            <>
              <div className="w-px h-8 bg-[#222]" />
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>High Impact</span>
              </div>
            </>
          )}

          <button
            onClick={() => { handleClearSelection(); setBlastResult(null); }}
            className="ml-1 text-[10px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Graph Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetZoom}
          className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-px bg-border-subtle my-1" />

        {/* Focus on selected */}
        {appSelectedNode && (
          <button
            onClick={handleFocusSelected}
            className="w-9 h-9 flex items-center justify-center bg-accent/20 border border-accent/30 rounded-md text-accent hover:bg-accent/30 transition-colors"
            title="Focus on Selected Node"
          >
            <Focus className="w-4 h-4" />
          </button>
        )}

        {/* Clear selection */}
        {sigmaSelectedNode && (
          <button
            onClick={handleClearSelection}
            className="w-9 h-9 flex items-center justify-center bg-elevated border border-border-subtle rounded-md text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
            title="Clear Selection"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Divider */}
        <div className="h-px bg-border-subtle my-1" />

        {/* Layout control */}
        <button
          onClick={isLayoutRunning ? stopLayout : startLayout}
          className={`
            w-9 h-9 flex items-center justify-center border rounded-md transition-all
            ${isLayoutRunning
              ? 'bg-accent border-accent text-white shadow-glow animate-pulse'
              : 'bg-elevated border-border-subtle text-text-secondary hover:bg-hover hover:text-text-primary'
            }
          `}
          title={isLayoutRunning ? 'Stop Layout' : 'Run Layout Again'}
        >
          {isLayoutRunning ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Layout running indicator */}
      {isLayoutRunning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full backdrop-blur-sm z-10 animate-fade-in">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          <span className="text-xs text-emerald-400 font-medium">Layout optimizing...</span>
        </div>
      )}

      {/* Query FAB */}
      <QueryFAB />

      {/* AI Highlights toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => {
            // If turning off, also clear process highlights
            if (isAIHighlightsEnabled) {
              setHighlightedNodeIds(new Set());
            }
            toggleAIHighlights();
          }}
          className={
            isAIHighlightsEnabled
              ? 'w-10 h-10 flex items-center justify-center bg-cyan-500/15 border border-cyan-400/40 rounded-lg text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-300/60 transition-colors'
              : 'w-10 h-10 flex items-center justify-center bg-elevated border border-border-subtle rounded-lg text-text-muted hover:bg-hover hover:text-text-primary transition-colors'
          }
          title={isAIHighlightsEnabled ? 'Turn off all highlights' : 'Turn on AI highlights'}
        >
          {isAIHighlightsEnabled ? <Lightbulb className="w-4 h-4" /> : <LightbulbOff className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
