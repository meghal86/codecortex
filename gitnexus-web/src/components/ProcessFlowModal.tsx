/**
 * Process Flow Modal
 * 
 * Displays a Mermaid flowchart for a process in a centered modal popup.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, GitBranch, Copy, Focus, Layers, ZoomIn, ZoomOut, Target, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import mermaid from 'mermaid';
import { ProcessData, generateProcessMermaid } from '../lib/mermaid-generator';
import { createChatModel, getActiveProviderConfig } from '../core/llm';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

interface ProcessFlowModalProps {
    process: ProcessData | null;
    onClose: () => void;
    onFocusInGraph?: (nodeIds: string[], processId: string) => void;
    isFullScreen?: boolean;
}

// Initialize mermaid with cyan/purple theme matching CodeCortex
// Initialize mermaid with cyan/purple theme matching CodeCortex
mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true, // Try to suppress if supported
    maxTextSize: 900000, // Increase from default 50000 to handle large combined diagrams
    theme: 'base',
    themeVariables: {
        primaryColor: '#1e293b', // node bg
        primaryTextColor: '#f1f5f9',
        primaryBorderColor: '#22d3ee',
        lineColor: '#94a3b8',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        mainBkg: '#1e293b', // background
        nodeBorder: '#22d3ee',
        clusterBkg: '#1e293b',
        clusterBorder: '#475569',
        titleColor: '#f1f5f9',
        edgeLabelBackground: '#0f172a',
    },
    flowchart: {
        curve: 'basis',
        padding: 50,
        nodeSpacing: 120,
        rankSpacing: 140,
        htmlLabels: true,
    },
});

// Suppress distinct syntax error overlay
mermaid.parseError = (err) => {
    // Suppress visual error - we handle errors in the render try/catch
    console.debug('Mermaid parse error (suppressed):', err);
};

export const ProcessFlowModal = ({ process, onClose, onFocusInGraph, isFullScreen = false }: ProcessFlowModalProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const diagramRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Full process map gets higher default zoom (667%) and max zoom (3000%)
    const defaultZoom = isFullScreen ? 6.67 : 1;
    const maxZoom = isFullScreen ? 30 : 10;

    const [zoom, setZoom] = useState(defaultZoom);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [isGenerating, setIsGenerating] = useState(false);
    const [computedDescription, setComputedDescription] = useState<string | null>(null);

    // Reset when process changes
    useEffect(() => {
        setComputedDescription(null);
    }, [process]);

    // Reset zoom when switching between full screen and regular mode
    useEffect(() => {
        setZoom(defaultZoom);
        setPan({ x: 0, y: 0 });
    }, [isFullScreen, defaultZoom]);

    // Handle zoom with scroll wheel
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY * -0.001;
            setZoom(prev => Math.min(Math.max(0.1, prev + delta), maxZoom));
        };

        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
            return () => container.removeEventListener('wheel', handleWheel);
        }
    }, [process, maxZoom]); // Re-attach when process or maxZoom changes

    // Handle keyboard zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') {
                setZoom(prev => Math.min(prev + 0.2, maxZoom));
            } else if (e.key === '-' || e.key === '_') {
                setZoom(prev => Math.max(prev - 0.2, 0.1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [maxZoom]);

    // Zoom in/out handlers
    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 0.25, maxZoom));
    }, [maxZoom]);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - 0.25, 0.1));
    }, []);

    // Handle pan with mouse drag
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }, [isPanning, panStart]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const resetView = useCallback(() => {
        setZoom(defaultZoom);
        setPan({ x: 0, y: 0 });
    }, [defaultZoom]);

    // Render mermaid diagram
    useEffect(() => {
        if (!process || !diagramRef.current) return;

        const renderDiagram = async () => {
            try {
                // Check if we have raw mermaid code (from AI chat) or need to generate it
                const mermaidCode = (process as any).rawMermaid
                    ? (process as any).rawMermaid
                    : generateProcessMermaid(process);
                const id = `mermaid-${Date.now()}`;

                // Clear previous content
                diagramRef.current!.innerHTML = '';

                const { svg } = await mermaid.render(id, mermaidCode);
                diagramRef.current!.innerHTML = svg;
            } catch (error) {
                console.error('Mermaid render error:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isSizeError = errorMessage.includes('Maximum') || errorMessage.includes('exceeded');

                diagramRef.current!.innerHTML = `
          <div class="text-center p-8">
            <div class="text-red-400 text-sm font-medium mb-2">
              ${isSizeError ? '📊 Diagram Too Large' : '⚠️ Render Error'}
            </div>
            <div class="text-slate-400 text-xs max-w-md">
              ${isSizeError
                        ? `This diagram has ${process.steps?.length || 0} steps and is too complex to render. Try viewing individual processes instead of "All Processes".`
                        : `Unable to render diagram. Steps: ${process.steps?.length || 0}`
                    }
            </div>
          </div>
        `;
            }
        };

        renderDiagram();
    }, [process]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Close on backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === containerRef.current) {
            onClose();
        }
    }, [onClose]);

    // Copy mermaid code to clipboard
    const handleCopyMermaid = useCallback(async () => {
        if (!process) return;
        const mermaidCode = generateProcessMermaid(process);
        await navigator.clipboard.writeText(mermaidCode);
    }, [process]);

    // Generate AI Summary
    const handleGenerateSummary = async () => {
        if (!process) return;

        const config = getActiveProviderConfig();
        if (!config || !config.apiKey) {
            alert('Please configure an AI provider in Settings first.');
            return;
        }

        try {
            setIsGenerating(true);
            const model = createChatModel(config);
            const prompt = `You are an expert software architect. Briefly summarize this execution flow in 2-3 short sentences. Focus on the business value, what the flow accomplishes, and its core responsibility.\n\nProcess Name: ${process.label}\nSteps:\n${[...process.steps].sort((a, b) => a.stepNumber - b.stepNumber).map(s => `${s.stepNumber}. ${s.name} (${s.filePath?.split('/').pop() || 'unknown'})`).join('\n')}`;

            const response = await model.invoke([
                new SystemMessage("You are a concise, technical AI. Do not use filler words. Be extremely precise and output 2-3 sentences max."),
                new HumanMessage(prompt)
            ]);

            if (typeof response.content === 'string') {
                setComputedDescription(response.content);
            } else {
                setComputedDescription(JSON.stringify(response.content));
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            alert('Failed to generate summary check console.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Focus in graph
    const handleFocusInGraph = useCallback(() => {
        if (!process || !onFocusInGraph) return;
        const nodeIds = process.steps.map(s => s.id);
        onFocusInGraph(nodeIds, process.id);
        onClose();
    }, [process, onFocusInGraph, onClose]);

    if (!process) return null;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 animate-fade-in"
            onClick={handleBackdropClick}
        >
            {/* Glassmorphism Modal */}
            <div className={`bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-cyan-500/10 flex flex-col animate-scale-in overflow-hidden relative ${isFullScreen
                ? 'w-[98%] h-[95vh] max-w-none'
                : 'w-[95%] max-w-5xl max-h-[90vh]'
                }`}>
                {/* Subtle gradient overlay for extra glass feel */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 relative z-10">
                    <h2 className="text-lg font-semibold text-white">
                        Process: {process.label}
                    </h2>
                </div>

                {/* Main Content Area: Diagram + Sidebar */}
                <div className="flex flex-1 overflow-hidden relative z-10 w-full h-full">

                    {/* Diagram */}
                    <div
                        ref={scrollContainerRef}
                        className={`flex-1 p-8 flex items-center justify-center relative overflow-hidden ${isFullScreen ? 'min-h-[70vh]' : 'min-h-[400px]'}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                    >
                        <div
                            ref={diagramRef}
                            className="[&_.edgePath_.path]:stroke-slate-400 [&_.edgePath_.path]:stroke-2 [&_.marker]:fill-slate-400 transition-transform origin-center w-fit h-fit"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            }}
                        />
                    </div>

                    {/* Chronological Steps Sidebar */}
                    <div className="w-80 border-l border-white/10 bg-slate-900/40 flex flex-col flex-shrink-0">
                        <div className="p-4 border-b border-white/10 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" />
                            <h3 className="text-sm font-semibold text-white">Execution Steps</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* AI Description Stub */}
                            {process.description || computedDescription ? (
                                <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="w-4 h-4 text-cyan-400" />
                                        <span className="text-xs font-semibold text-cyan-300">AI Summary</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        {process.description || computedDescription}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg flex flex-col items-start gap-3">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            AI Summary not generated for this process flow.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleGenerateSummary}
                                        disabled={isGenerating}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-950/30 hover:bg-cyan-900/40 border border-cyan-800/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? (
                                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                                        ) : (
                                            <><Sparkles className="w-3.5 h-3.5" /> Generate Summary</>
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-700/50 pt-2">
                                {[...process.steps].sort((a, b) => a.stepNumber - b.stepNumber).map((step, idx, arr) => {
                                    const isFirst = idx === 0;
                                    const isLast = idx === arr.length - 1;

                                    return (
                                        <div key={step.id} className="relative pl-10 pr-2 py-1 group">
                                            {/* Step point indicator */}
                                            <div className={`absolute left-2.5 top-2.5 w-2.5 h-2.5 rounded-full border-2 ${isFirst ? 'bg-emerald-500 border-emerald-900' :
                                                isLast ? 'bg-pink-500 border-pink-900' :
                                                    'bg-cyan-500 border-cyan-900'
                                                } z-10 shadow-[0_0_8px_rgba(34,211,238,0.5)]`} />

                                            <div className="bg-slate-800/40 hover:bg-slate-800 border border-transparent hover:border-slate-600 p-2.5 rounded-lg transition-colors cursor-pointer"
                                                onClick={() => {
                                                    if (onFocusInGraph) {
                                                        onFocusInGraph([step.id], process.id);
                                                        onClose();
                                                    }
                                                }}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-xs font-medium text-slate-200 truncate flex-1" title={step.name}>
                                                        {step.name}
                                                    </span>
                                                    <Target className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                {step.filePath && (
                                                    <div className="text-[10px] text-slate-500 truncate mt-1" title={step.filePath}>
                                                        {step.filePath.split('/').pop()}
                                                    </div>
                                                )}
                                                {step.cluster && (
                                                    <div className="mt-1.5 inline-block px-1.5 py-0.5 bg-slate-900 rounded text-[9px] text-slate-400 font-medium">
                                                        {step.cluster}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/50 relative z-10">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                        <button
                            onClick={handleZoomOut}
                            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-all"
                            title="Zoom out (-)"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="px-2 text-xs text-slate-400 font-mono min-w-[3rem] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-all"
                            title="Zoom in (+)"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={resetView}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                        title="Reset zoom and pan"
                    >
                        Reset View
                    </button>
                    {onFocusInGraph && (
                        <button
                            onClick={handleFocusInGraph}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                        >
                            <Focus className="w-4 h-4" />
                            Toggle Focus
                        </button>
                    )}
                    <button
                        onClick={handleCopyMermaid}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                    >
                        <Copy className="w-4 h-4" />
                        Copy Mermaid
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
