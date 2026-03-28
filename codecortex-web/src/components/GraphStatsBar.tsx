import { useMemo } from 'react';
import { AlertTriangle, Flame, GitFork, Users, Cpu, TrendingUp } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';

/**
 * GraphStatsBar — A thin, data-dense metrics bar positioned above the graph canvas.
 * Shows live architectural intelligence computed from the loaded graph.
 * Each metric is clickable to trigger the corresponding Command Bar action.
 */
export const GraphStatsBar = () => {
  const { graph } = useAppState();

  const stats = useMemo(() => {
    if (!graph) return null;

    const nodes = graph.nodes.filter(n => !n.properties.hidden);
    const edges = graph.relationships.filter(r => !r.hidden);

    // Violation count
    const violations = edges.filter(r => r.violation).length;

    // Hotspot count (nodes with hotspotScore > 5)
    const hotspots = nodes.filter(n => (n.properties.hotspotScore || 0) > 5).length;

    // Average complexity
    const complexNodes = nodes.filter(n => n.properties.complexityScore !== undefined);
    const avgComplexity = complexNodes.length > 0
      ? complexNodes.reduce((sum, n) => sum + (n.properties.complexityScore || 0), 0) / complexNodes.length
      : 0;

    // High complexity nodes (score > 30)
    const highComplexity = nodes.filter(n => (n.properties.complexityScore || 0) > 30).length;

    // Orphan nodes (0 incoming edges)
    const nodesWithIncoming = new Set(edges.map(r => r.targetId));
    const orphans = nodes.filter(n => !nodesWithIncoming.has(n.id) && n.label !== 'Folder' && n.label !== 'Project').length;

    // Bus factor risk (ownership > 80%)
    const busFactor = nodes.filter(n => (n.properties.ownership || 0) > 80).length;

    // Unique communities
    const communities = new Set(nodes.map(n => n.properties.community).filter(Boolean)).size;

    // Architecture Health Score (0-100, higher=healthier)
    // Penalizes: high avg complexity, many violations, many orphans, low subsystem separation
    let healthScore = 100;
    if (violations > 0) healthScore -= Math.min(30, violations * 5); // -5 per violation, max -30
    if (avgComplexity > 10) healthScore -= Math.min(20, Math.round((avgComplexity - 10) * 2)); // penalty above 10
    if (nodes.length > 0) {
      const orphanRatio = orphans / nodes.length;
      if (orphanRatio > 0.1) healthScore -= Math.min(15, Math.round(orphanRatio * 50)); // >10% orphans
    }
    if (highComplexity > 5) healthScore -= Math.min(15, (highComplexity - 5) * 2);
    healthScore = Math.max(0, healthScore);

    return { violations, hotspots, avgComplexity, highComplexity, orphans, busFactor, communities, nodeCount: nodes.length, edgeCount: edges.length, healthScore };
  }, [graph]);

  if (!stats) return null;

  return (
    <div className="flex items-center h-8 px-4 gap-5 bg-[#080808] border-b border-[#1c1c1c] text-[11px] font-mono select-none shrink-0 overflow-x-auto">

      {/* Health Score — THE number */}
      <div className="flex items-center gap-2 pr-4 border-r border-[#1c1c1c] shrink-0">
        <span className="text-[10px] text-[#52525b] uppercase tracking-wider">Health</span>
        <span className={`text-[14px] font-bold ${
          stats.healthScore >= 80 ? 'text-emerald-400'
          : stats.healthScore >= 50 ? 'text-amber-400'
          : 'text-red-400'
        }`}>
          {stats.healthScore}
        </span>
        <span className="text-[10px] text-[#27272a]">/100</span>
      </div>

      {/* Violations */}
      {stats.violations > 0 && (
        <Stat icon={AlertTriangle} label="Violations" value={stats.violations} color="text-red-400" />
      )}

      {/* High Complexity */}
      {stats.highComplexity > 0 && (
        <Stat icon={Cpu} label="Complex" value={stats.highComplexity} color="text-amber-400" />
      )}

      {/* Hotspots */}
      {stats.hotspots > 0 && (
        <Stat icon={Flame} label="Hotspots" value={stats.hotspots} color="text-orange-400" />
      )}

      {/* Avg Complexity */}
      <Stat icon={TrendingUp} label="Avg Complexity" value={stats.avgComplexity.toFixed(1)} color="text-[#52525b]" />

      {/* Communities */}
      <Stat icon={GitFork} label="Subsystems" value={stats.communities} color="text-[#52525b]" />

      {/* Bus Factor */}
      {stats.busFactor > 0 && (
        <Stat icon={Users} label="Bus Factor Risk" value={stats.busFactor} color="text-violet-400" />
      )}

      {/* Orphans */}
      {stats.orphans > 0 && (
        <div className="flex items-center gap-1.5 text-[#3f3f46]">
          <span className="text-[10px]">{stats.orphans} unreferenced</span>
        </div>
      )}
    </div>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="flex items-center gap-1.5 shrink-0 cursor-default" title={label}>
    <Icon className={`w-3 h-3 ${color}`} />
    <span className="text-[#52525b]">{label}</span>
    <span className={`font-semibold ${color}`}>{value}</span>
  </div>
);
