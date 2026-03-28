import { useState, useMemo } from 'react';
import { GitPullRequest, Search, Zap, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { calculateBlastRadius, BlastRadiusResult } from '../lib/blast-radius';

export const PRPulsePanel = () => {
    const {
        graph,
        fileContents,
        blastRadiusNodeIds,
        setBlastRadiusNodeIds,
        isolateBlastRadius,
        setIsolateBlastRadius,
        setSelectedNode,
    } = useAppState();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [result, setResult] = useState<BlastRadiusResult | null>(null);

    // Get all file nodes from the graph
    const allFiles = useMemo(() => {
        if (!graph) return [];
        return graph.nodes
            .filter((n) => n.label === 'File')
            .map((n) => ({
                id: n.id,
                path: n.properties.filePath || n.properties.name,
            }))
            .sort((a, b) => a.path.localeCompare(b.path));
    }, [graph]);

    const filteredFiles = useMemo(() => {
        if (!searchQuery) return allFiles.slice(0, 50); // Show max 50 by default
        const query = searchQuery.toLowerCase();
        return allFiles.filter((f) => f.path.toLowerCase().includes(query)).slice(0, 50);
    }, [allFiles, searchQuery]);

    const toggleFile = (id: string) => {
        const next = new Set(selectedFiles);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedFiles(next);
    };

    const handleAnalyze = () => {
        if (!graph || selectedFiles.size === 0) return;

        // Calculate Blast Radius
        const changedNodeIds = Array.from(selectedFiles);
        const impact = calculateBlastRadius(graph, changedNodeIds, 2);

        setResult(impact);
        setBlastRadiusNodeIds(impact.affectedNodeIds);

        // Clear selected node so blast radius highlighting is visible
        setSelectedNode(null);
    };

    const clearAnalysis = () => {
        setSelectedFiles(new Set());
        setResult(null);
        setBlastRadiusNodeIds(new Set());
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-deep text-text-primary overflow-hidden">

            {/* Header Area */}
            <div className="p-4 bg-surface border-b border-border-subtle shrink-0">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
                    <GitPullRequest className="w-4 h-4 text-accent" />
                    PR Pulse Analysis
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed mb-4">
                    Select files that are changing in your Pull Request to visualize the blast radius and overall risk.
                </p>

                {/* Selected Files Chips */}
                {selectedFiles.size > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 max-h-[80px] overflow-y-auto scrollbar-thin">
                        {Array.from(selectedFiles).map((id) => {
                            const file = allFiles.find(f => f.id === id);
                            if (!file) return null;
                            return (
                                <div key={id} className="flex items-center gap-1.5 px-2 py-1 bg-elevated border border-border-subtle rounded text-[11px] truncate max-w-full">
                                    <span className="truncate">{file.path.split('/').pop()}</span>
                                    <button onClick={() => toggleFile(id)} className="text-text-muted hover:text-red-400">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAnalyze}
                        disabled={selectedFiles.size === 0}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-semibold rounded-md transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Analyze Impact
                    </button>

                    {(selectedFiles.size > 0 || result) && (
                        <button
                            onClick={clearAnalysis}
                            className="px-3 py-2 bg-elevated hover:bg-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-md text-xs font-medium transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Results or File Selector Area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {result ? (
                    <div className="p-4 space-y-4 animate-fade-in">
                        {/* Risk Score Card */}
                        <div className={`p-4 rounded-xl border ${result.riskScore > 75 ? 'bg-rose-500/10 border-rose-500/30' : result.riskScore > 40 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <AlertTriangle className={`w-4 h-4 ${result.riskScore > 75 ? 'text-rose-400' : result.riskScore > 40 ? 'text-orange-400' : 'text-emerald-400'}`} />
                                    <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Impact Risk</span>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-4xl font-black tracking-tighter ${result.riskScore > 75 ? 'text-rose-500' : result.riskScore > 40 ? 'text-orange-500' : 'text-emerald-400'}`}>
                                    {result.riskScore}
                                </span>
                                <span className="text-xs text-text-muted font-medium">/ 100</span>
                            </div>
                            <p className="text-xs mt-2 text-text-primary/80">
                                {result.riskScore > 75 ? 'High risk. Major structural changes detected.' :
                                    result.riskScore > 40 ? 'Moderate risk. Observe testing closely.' :
                                        'Low risk. Changes are well-contained.'}
                            </p>
                        </div>

                        {/* Impact Summary */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-elevated p-3 rounded-lg border border-border-subtle flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-text-primary">{selectedFiles.size}</span>
                                <span className="text-[10px] uppercase font-semibold text-text-muted mt-1">Files Changed</span>
                            </div>
                            <div className="bg-elevated p-3 rounded-lg border border-border-subtle flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-cyan-400">{result.affectedNodeIds.size}</span>
                                <span className="text-[10px] uppercase font-semibold text-text-muted mt-1">Nodes Affected</span>
                            </div>
                        </div>

                        {/* Isolate Toggle */}
                        <div className="bg-elevated p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-text-primary">Isolate Risk View</span>
                                <span className="text-[10px] text-text-muted">Hide unaffected nodes in graph</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={isolateBlastRadius}
                                    onChange={(e) => setIsolateBlastRadius(e.target.checked)}
                                />
                                <div className="w-9 h-5 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border-subtle after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white border border-border-subtle"></div>
                            </label>
                        </div>

                        <p className="text-[11px] text-text-muted text-center pt-2">
                            Viewing highlighted nodes in the graph view.
                        </p>
                    </div>
                ) : (
                    <div className="p-0">
                        {/* Search Input */}
                        <div className="sticky top-0 bg-deep px-3 py-2 border-b border-border-subtle z-10">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-elevated border border-border-subtle rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                />
                            </div>
                        </div>

                        {/* File List */}
                        <div className="p-2 space-y-0.5">
                            {filteredFiles.length === 0 ? (
                                <div className="text-center py-8 text-text-muted text-xs">
                                    {allFiles.length === 0 ? "No files analyzed yet." : "No files matching search."}
                                </div>
                            ) : (
                                filteredFiles.map((file) => {
                                    const isSelected = selectedFiles.has(file.id);
                                    return (
                                        <button
                                            key={file.id}
                                            onClick={() => toggleFile(file.id)}
                                            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors ${isSelected
                                                ? 'bg-accent/10 border border-accent/30 text-accent'
                                                : 'bg-transparent border border-transparent hover:bg-hover text-text-primary'
                                                }`}
                                        >
                                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${isSelected ? 'bg-accent border-accent text-white' : 'bg-surface border-text-muted'
                                                }`}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                                            </div>
                                            <span className="truncate flex-1" title={file.path}>{file.path}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
