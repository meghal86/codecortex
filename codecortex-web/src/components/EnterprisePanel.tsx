import React, { useEffect, useState, useMemo } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { Network, Activity, ShieldAlert, Cpu, Maximize2, X, Search, Terminal, Zap, Layers } from 'lucide-react';

export const EnterprisePanel: React.FC = () => {
  const { subsystems, deserts, isLoading, error, refreshAnalytics } = useAnalytics();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    refreshAnalytics();
  }, [refreshAnalytics]);

  // Group subsystems by cluster
  const clusters = useMemo(() => {
    if (!subsystems) return {};
    const grouped: Record<number, string[]> = {};
    let totalNodes = 0;
    for (const [node, clusterId] of Object.entries(subsystems)) {
      if (!grouped[clusterId]) grouped[clusterId] = [];
      grouped[clusterId].push(node);
      totalNodes++;
    }
    return { grouped, totalNodes, clusterCount: Object.keys(grouped).length };
  }, [subsystems]);

  const debtScore = useMemo(() => {
    if (!deserts) return 0;
    return Math.min(100, Math.round(deserts.reduce((acc, d) => acc + Math.abs(d.utility_score), 0) * 12.5));
  }, [deserts]);

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in">
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center justify-center gap-3 px-6 py-3 bg-[#0a0f18]/90 backdrop-blur-xl border-y border-[#1e293b] shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-full hover:bg-[#0f172a] hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all duration-300 pointer-events-auto"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
            <Activity className="w-4 h-4 text-cyan-400 group-hover:animate-pulse" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">CodeCortex</span>
            <span className="text-sm font-bold text-slate-200 tracking-wide">Enterprise Analytics</span>
          </div>
          <div className="h-6 w-px bg-slate-800 mx-2" />
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#ef4444]">Risk</span>
                <span className="text-xs font-mono font-bold text-slate-300">{deserts?.length || 0}</span>
             </div>
             <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold tracking-widest text-[#06b6d4]">Subsystems</span>
                <span className="text-xs font-mono font-bold text-slate-300">{clusters.clusterCount || 0}</span>
             </div>
          </div>
          <Maximize2 className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors ml-2" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#05080f] text-slate-300 animate-fade-in pointer-events-auto overflow-hidden">
      {/* Dynamic Grid Background overlay */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Top Navbar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 bg-[#0a0f18]/90 backdrop-blur-md border-b border-[#1e293b]">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-widest uppercase">CodeCortex <span className="text-indigo-400 font-light">Analytics</span></h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Target Environment • Production Cluster</p>
          </div>
        </div>
        
        {/* Command Search Bar Placeholder */}
        <div className="flex-1 max-w-xl mx-8">
           <div className="flex items-center gap-3 px-4 py-2 bg-[#0f172a] border border-[#1e293b] rounded-md focus-within:border-cyan-500/50 transition-colors">
              <Search className="w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search architecture, query logs, or clusters... (Press '/')" className="bg-transparent border-none outline-none text-xs w-full text-slate-200 font-mono placeholder:text-slate-600 focus:ring-0" />
              <div className="px-1.5 py-0.5 rounded bg-[#1e293b] text-[9px] font-bold text-slate-400">⌘K</div>
           </div>
        </div>

        <button onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] hover:border-slate-700 rounded-md transition-all text-xs font-bold uppercase tracking-widest text-slate-400">
           <X className="w-4 h-4" />
           Close Dashboard
        </button>
      </header>

      {/* Main Dashboard Content */}
      <main className="relative z-10 flex-1 overflow-y-auto p-6 scrollbar-thin">
        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-[#1e293b] overflow-hidden">
             <div className="h-full bg-cyan-500 animate-pulse w-1/3 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          </div>
        )}

        {/* KPI Cards Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
           <div className="flex items-start justify-between p-5 bg-[#0a0f18]/80 border border-[#1e293b] rounded-lg shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <div>
                 <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Knowledge Deserts</h3>
                 <div className="text-4xl font-light font-mono text-white">{deserts?.length || 0}</div>
              </div>
              <ShieldAlert className="w-8 h-8 text-red-500/20 group-hover:text-red-500/40 transition-colors" />
           </div>

           <div className="flex items-start justify-between p-5 bg-[#0a0f18]/80 border border-[#1e293b] rounded-lg shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
              <div>
                 <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Architecture Debt</h3>
                 <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-light font-mono text-white">{debtScore}</div>
                    <span className="text-xs font-mono text-orange-400">/ 100</span>
                 </div>
              </div>
              <Zap className="w-8 h-8 text-orange-500/20 group-hover:text-orange-500/40 transition-colors" />
           </div>

           <div className="flex items-start justify-between p-5 bg-[#0a0f18]/80 border border-[#1e293b] rounded-lg shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
              <div>
                 <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Emergent Clusters</h3>
                 <div className="text-4xl font-light font-mono text-white">{clusters.clusterCount || 0}</div>
              </div>
              <Network className="w-8 h-8 text-cyan-500/20 group-hover:text-cyan-500/40 transition-colors" />
           </div>

           <div className="flex items-start justify-between p-5 bg-[#0a0f18]/80 border border-[#1e293b] rounded-lg shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <div>
                 <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Total Mapped Nodes</h3>
                 <div className="text-4xl font-light font-mono text-white">{clusters.totalNodes || 0}</div>
              </div>
              <Cpu className="w-8 h-8 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors" />
           </div>
        </div>

        {/* Data Grid row */}
        <div className="grid grid-cols-2 gap-6 h-[500px]">
           {/* Left Column: Security/Debt Logs */}
           <div className="flex flex-col bg-[#0a0f18]/80 border border-[#1e293b] rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b] bg-[#0f172a]/50">
                 <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Security & Debt Activity Stream</h3>
                 </div>
                 <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest">Live</span>
              </div>
              <div className="flex-1 overflow-y-auto p-0 scrollbar-thin font-mono text-[11px]">
                 {deserts && deserts.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                       <thead className="sticky top-0 bg-[#0f172a]/95 backdrop-blur z-10 text-[9px] uppercase tracking-widest text-slate-500">
                          <tr>
                             <th className="py-2 px-4 border-b border-[#1e293b] font-medium w-32">Timestamp</th>
                             <th className="py-2 px-4 border-b border-[#1e293b] font-medium w-24">Severity</th>
                             <th className="py-2 px-4 border-b border-[#1e293b] font-medium">Intent Query / Event</th>
                             <th className="py-2 px-4 border-b border-[#1e293b] font-medium text-right">Utility</th>
                          </tr>
                       </thead>
                       <tbody>
                          {deserts.map((d, i) => (
                             <tr key={i} className="hover:bg-[#0f172a] transition-colors group cursor-pointer border-b border-[#1e293b]/50">
                                <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{(new Date(Date.now() - i * 3600000)).toISOString().replace('T', ' ').slice(0, 19)}</td>
                                <td className="py-2.5 px-4">
                                   <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest">Critical</span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-300 group-hover:text-cyan-400 transition-colors">"{d.intent}"</td>
                                <td className="py-2.5 px-4 text-right text-orange-400">{d.utility_score}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 ) : (
                    <div className="h-full flex items-center justify-center flex-col text-slate-500">
                       <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                       <p className="uppercase tracking-widest">No Critical Events Detected</p>
                    </div>
                 )}
              </div>
           </div>

           {/* Right Column: Architectural Label Clusters (Datadog Service Map style) */}
           <div className="flex flex-col bg-[#0a0f18]/80 border border-[#1e293b] rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b] bg-[#0f172a]/50">
                 <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Biometric Cluster Map</h3>
                 </div>
                 <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">Label Propagation</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                 {Object.keys(clusters.grouped || {}).length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                       {Object.entries(clusters.grouped!).map(([clusterId, nodes]) => (
                          <div key={clusterId} className="flex flex-col border border-[#1e293b] bg-[#0f172a]/40 rounded-md hover:border-cyan-500/30 hover:bg-[#0f172a]/80 transition-all cursor-pointer group">
                             <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b]">
                                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Subsystem {clusterId}</span>
                                <span className="text-[10px] font-mono text-slate-500 bg-[#0a0f18] px-1.5 py-0.5 rounded">{nodes.length} N</span>
                             </div>
                             <div className="p-3 max-h-24 overflow-y-auto scrollbar-thin font-mono text-[9px] text-slate-400 leading-relaxed group-hover:text-slate-300">
                                {nodes.join(', ')}
                             </div>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="h-full flex items-center justify-center flex-col text-slate-500">
                       <Network className="w-8 h-8 mb-2 opacity-50" />
                       <p className="uppercase tracking-widest">Awaiting Topology Sync</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
};
