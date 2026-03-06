import { X, ZoomIn, MousePointerClick, MessageSquareText } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HelpModal = ({ isOpen, onClose }: HelpModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-surface border border-border-default rounded-3xl shadow-2xl p-8 relative animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-text-muted hover:text-text-primary bg-elevated rounded-full hover:bg-hover transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold text-text-primary mb-2">How to Use CodeCortex</h2>
                <p className="text-text-secondary mb-8">
                    Think of CodeCortex as a map for your code. It scans your entire repository and turns it into an interactive visual graph so you can instantly understand how your project is structured, what calls what, and where the important pieces are.
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-elevated p-6 rounded-2xl border border-border-subtle">
                        <h3 className="text-lg font-semibold text-accent mb-3 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
                            Nodes (The Dots)
                        </h3>
                        <p className="text-sm text-text-secondary">
                            Each dot represents a piece of your code — a File, Folder, Function, or Class. Bigger dots mean it's more connected and important. This lets you spot the critical parts of your project at a glance.
                        </p>
                    </div>

                    <div className="bg-elevated p-6 rounded-2xl border border-border-subtle">
                        <h3 className="text-lg font-semibold text-accent mb-3 flex items-center gap-2">
                            <span className="w-3 h-1 rounded-full bg-cyan-600"></span>
                            Edges (The Lines)
                        </h3>
                        <p className="text-sm text-text-secondary">
                            Lines show how code connects: imports, function calls, inheritance, and more. Follow the lines to trace how data flows through your app or track down where a bug might live.
                        </p>
                    </div>
                </div>

                <h3 className="text-[15px] font-semibold text-text-primary mb-4 uppercase tracking-wider">Quick Navigation Tips</h3>

                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-elevated rounded-lg text-accent mt-0.5">
                            <ZoomIn className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-primary">Zoom & Pan</p>
                            <p className="text-xs text-text-secondary">Use your mouse wheel to zoom in to see individual file names, and click-and-drag the background to move around.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-elevated rounded-lg text-accent mt-0.5">
                            <MousePointerClick className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-primary">Drill Down</p>
                            <p className="text-xs text-text-secondary">Click any dot to focus on it. The map will dim everything except that node and its direct connections.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-gradient-to-br from-accent to-accent-dim rounded-lg text-white mt-0.5 shadow-glow">
                            <MessageSquareText className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-text-primary">Ask the AI</p>
                            <p className="text-xs text-text-secondary">Click "Cortex AI" in the top right to ask questions about your code. It can explain complex functions, find potential bugs, suggest refactors, and even show you blast-radius analysis for risky changes.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-accent hover:bg-accent-dim text-white font-medium rounded-xl transition-colors"
                    >
                        Got it! Let's explore
                    </button>
                </div>
            </div>
        </div>
    );
};
