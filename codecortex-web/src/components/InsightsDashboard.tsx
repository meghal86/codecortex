import React, { useMemo } from 'react';
import { useAppState } from '../hooks/useAppState';
import { X, Network, AlertTriangle, Ghost, ArrowRight } from 'lucide-react';

export const InsightsDashboard: React.FC = () => {
    const { graph, isInsightsDashboardOpen, setInsightsDashboardOpen, setSelectedNode } = useAppState();

    // Compute metrics
    const insights = useMemo(() => {
        if (!graph || graph.nodes.length === 0) return null;

        // 1. The Traffic Jam (Highest In-Degree)
        const trafficJamNode = [...graph.nodes].sort((a, b) => (b.properties.inDegree || 0) - (a.properties.inDegree || 0))[0];

        // 2. The Spaghetti Trap (Highest Complexity)
        const spaghettiNode = [...graph.nodes].sort((a, b) => (b.properties.complexityScore || 0) - (a.properties.complexityScore || 0))[0];

        // 3. The Ghost Town (Stale Code / Isolated)
        // For mock purposes, find a node with 0 in-degree and 0 out-degree, or low PageRank
        const ghostNode = graph.nodes.find(n => (n.properties.inDegree === 0 && n.properties.outDegree === 0)) || graph.nodes[graph.nodes.length - 1];

        return { trafficJamNode, spaghettiNode, ghostNode };
    }, [graph]);

    if (!isInsightsDashboardOpen || !insights) return null;

    const { trafficJamNode, spaghettiNode, ghostNode } = insights;

    const handleFocus = (nodeId: string) => {
        setInsightsDashboardOpen(false);
        const node = graph?.nodes.find(n => n.id === nodeId);
        if (node) setSelectedNode(node);
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-void/80 backdrop-blur-sm">
            <div className="bg-deep border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div>
                        <h2 className="text-2xl font-semibold text-text flex items-center gap-3">
                            <span className="bg-gradient-to-r from-accent to-node-interface bg-clip-text text-transparent">Code Story</span>
                            Executive Summary
                        </h2>
                        <p className="text-text-muted mt-1 text-sm">
                            We translated your architectural graph into plain-English business insights.
                        </p>
                    </div>
                    <button
                        onClick={() => setInsightsDashboardOpen(false)}
                        className="p-2 hover:bg-white/5 rounded-lg text-text-muted hover:text-text transition-colors"
                        title="Close Dashboard"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Cards Grid */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-b from-deep to-void">

                    {/* Traffic Jam */}
                    {trafficJamNode && (
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 flex flex-col hover:bg-white/[0.05] transition-colors group">
                            <div className="w-12 h-12 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center mb-4">
                                <Network size={24} />
                            </div>
                            <h3 className="text-lg font-medium text-text mb-2 flex items-center gap-2">
                                🚦 The Traffic Jam
                            </h3>
                            <p className="text-sm text-text-muted mb-4 flex-grow">
                                Almost every part of your app relies on <code className="text-accent bg-accent/10 px-1 py-0.5 rounded">{trafficJamNode.properties.name}</code>. It is a critical chokepoint. If a developer makes a mistake here, the entire application risks crashing. We highly recommend breaking this apart.
                            </p>
                            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="text-xs text-text-muted">
                                    <span className="text-orange-400 font-medium">{trafficJamNode.properties.inDegree}</span> components depend on this.
                                </div>
                                <button onClick={() => handleFocus(trafficJamNode.id)} className="text-xs font-medium text-accent hover:text-accent-light flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    View on Map <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Spaghetti Trap */}
                    {spaghettiNode && (
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 flex flex-col hover:bg-white/[0.05] transition-colors group">
                            <div className="w-12 h-12 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-medium text-text mb-2 flex items-center gap-2">
                                💀 The Spaghetti Trap
                            </h3>
                            <p className="text-sm text-text-muted mb-4 flex-grow">
                                Developers likely spend 30% more time debugging <code className="text-secondary bg-secondary/10 px-1 py-0.5 rounded">{spaghettiNode.properties.name}</code> due to its highly tangled internal structure and complex logic. This is a prime candidate for our Auto-Architect refactoring.
                            </p>
                            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="text-xs text-text-muted">
                                    Complexity Score: <span className="text-red-400 font-medium">{spaghettiNode.properties.complexityScore || 'High'}</span>
                                </div>
                                <button onClick={() => handleFocus(spaghettiNode.id)} className="text-xs font-medium text-accent hover:text-accent-light flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    View on Map <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Ghost Town */}
                    {ghostNode && (
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 flex flex-col hover:bg-white/[0.05] transition-colors group">
                            <div className="w-12 h-12 rounded-lg bg-gray-500/20 text-gray-400 flex items-center justify-center mb-4">
                                <Ghost size={24} />
                            </div>
                            <h3 className="text-lg font-medium text-text mb-2 flex items-center gap-2">
                                👻 The Ghost Town
                            </h3>
                            <p className="text-sm text-text-muted mb-4 flex-grow">
                                <code className="text-gray-300 bg-gray-700/50 px-1 py-0.5 rounded">{ghostNode.properties.name}</code> appears to be completely isolated. No other parts of your architecture depend on it, and it doesn't call anything else. This might be dead code that is safe to delete to reduce bloat.
                            </p>
                            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="text-xs text-text-muted">
                                    <span className="text-gray-400 font-medium">0</span> active connections.
                                </div>
                                <button onClick={() => handleFocus(ghostNode.id)} className="text-xs font-medium text-accent hover:text-accent-light flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    View on Map <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="px-8 py-4 border-t border-white/5 bg-white/[0.02] flex justify-center">
                    <button
                        onClick={() => setInsightsDashboardOpen(false)}
                        className="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        Acknowledge & Explore Graph <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
