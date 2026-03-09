import { FC, useState, useMemo } from 'react';
import { useAppState } from '../hooks/useAppState';
import { History, GitCommit as GitIcon, User, MessageSquare, Clock } from 'lucide-react';

const formatRelativeTime = (date: Date) => {
    const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const diffInDays = Math.floor(diffInSeconds / 86400);

    if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    const diffInHours = Math.floor(diffInSeconds / 3600);
    if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes > 0) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    return 'just now';
};

export const TimelineScrubber: FC = () => {
    const { commits, selectedCommitId, setSelectedCommitId } = useAppState();
    const [hoveredCommitId, setHoveredCommitId] = useState<string | null>(null);

    if (!commits || commits.length === 0) return null;

    const selectedCommit = useMemo(() =>
        commits.find(c => c.id === selectedCommitId) || commits[commits.length - 1],
        [commits, selectedCommitId]
    );

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-void-dark/90 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex flex-col gap-3 z-50 shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                    <History size={18} className="animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Evolution Timeline</h3>
                </div>

                {selectedCommit && (
                    <div className="flex items-center gap-4 text-xs text-white/60">
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-blue-400" />
                            <span>{formatRelativeTime(new Date(selectedCommit.date))}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <GitIcon size={14} className="text-purple-400" />
                            <span className="font-mono text-white/80">{selectedCommit.hash}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <User size={14} className="text-orange-400" />
                            <span>{selectedCommit.author}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative h-12 flex items-center">
                {/* Progress line */}
                <div className="absolute h-1 w-full bg-white/5 rounded-full" />
                <div
                    className="absolute h-1 bg-primary/40 rounded-full transition-all duration-500"
                    style={{
                        width: `${((commits.findIndex(c => c.id === (selectedCommitId || selectedCommit?.id)) || 0) / (commits.length - 1)) * 100}%`
                    }}
                />

                {/* Commit Points */}
                <div className="relative w-full flex justify-between">
                    {commits.map((commit, index) => {
                        const isSelected = commit.id === (selectedCommitId || selectedCommit?.id);
                        const isHovered = commit.id === hoveredCommitId;

                        return (
                            <div
                                key={commit.id}
                                className="group relative flex flex-col items-center"
                                onMouseEnter={() => setHoveredCommitId(commit.id)}
                                onMouseLeave={() => setHoveredCommitId(null)}
                            >
                                <button
                                    onClick={() => setSelectedCommitId(commit.id)}
                                    className={`
                    w-4 h-4 rounded-full transition-all duration-300 z-10
                    ${isSelected ? 'bg-primary ring-4 ring-primary/20 scale-125' : 'bg-white/20 hover:bg-white/40'}
                    ${isHovered && !isSelected ? 'ring-2 ring-white/20 scale-110' : ''}
                  `}
                                />

                                {/* Tooltip */}
                                {(isHovered || isSelected) && (
                                    <div className={`
                    absolute bottom-8 w-64 bg-slate-900 border border-white/10 p-3 rounded-lg shadow-2xl z-50
                    pointer-events-none transition-all duration-200
                    ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                    flex flex-col gap-2
                  `}>
                                        <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold border-b border-white/5 pb-1">
                                            <GitIcon size={12} />
                                            {commit.hash}
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <MessageSquare size={14} className="mt-0.5 text-white/40 shrink-0" />
                                            <p className="text-xs text-white/90 leading-tight italic line-clamp-2">{commit.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selection Details */}
            <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium text-center">
                Drag or click points to explore architectural drift
            </div>
        </div>
    );
};
