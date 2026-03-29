import { PipelineProgress } from '../types/pipeline';

interface LoadingOverlayProps {
  progress: PipelineProgress;
}

export const LoadingOverlay = ({ progress }: LoadingOverlayProps) => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#000] z-50 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center px-6">

        {/* Brand Icon */}
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-lg text-white font-bold select-none">◈</span>
        </div>

        {/* Status */}
        <p className="text-[14px] font-medium text-[#ededed] mb-2 tracking-tight">
          Building Architecture Graph
        </p>
        <p className="text-[12px] text-[#52525b] font-mono mb-8">
          {progress.message}
          <span className="animate-pulse ml-1 text-[#3f3f46]">|</span>
        </p>

        {/* Progress bar */}
        <div className="w-full mb-6">
          <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#ededed] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[#3f3f46] font-mono">{progress.percent}%</span>
            <span className="text-[10px] text-[#3f3f46] font-mono capitalize">
              {progress.phase === 'complete' ? 'Done' : progress.phase === 'error' ? 'Error' : progress.phase}
            </span>
          </div>
        </div>

        {/* Stats */}
        {progress.stats ? (
          <div className="w-full grid grid-cols-2 gap-3">
            <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-3 text-center">
              <span className="block text-[18px] font-semibold text-[#ededed] font-mono tracking-tight">
                {progress.stats.filesProcessed}<span className="text-[#3f3f46] text-[12px] ml-1">/ {progress.stats.totalFiles}</span>
              </span>
              <span className="text-[10px] text-[#52525b] uppercase tracking-widest font-medium">Files</span>
            </div>
            <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-3 text-center">
              <span className="block text-[18px] font-semibold text-[#ededed] font-mono tracking-tight">
                {progress.stats.nodesCreated}
              </span>
              <span className="text-[10px] text-[#52525b] uppercase tracking-widest font-medium">Nodes</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[#3f3f46] font-mono">Indexing architecture...</p>
        )}

        {/* Detail */}
        {progress.detail && (
          <div className="mt-4 w-full">
            <p className="text-[10px] text-[#27272a] font-mono truncate px-3 py-1.5 bg-[#0a0a0a] border border-[#1c1c1c] rounded">
              {progress.detail}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
