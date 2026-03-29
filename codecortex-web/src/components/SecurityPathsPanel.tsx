import React, { useMemo } from 'react';
import { useAppState } from '../hooks/useAppState';
import { ShieldAlert, Database, Globe, HardDrive, Key, Terminal, ArrowRight, XCircle } from 'lucide-react';
import { SinkMatch } from '../core/analysis/taint-analysis';

const TYPE_ICONS = {
  filesystem: HardDrive,
  database: Database,
  network: Globe,
  auth: Key,
  os: Terminal
};

const TYPE_LABELS = {
  filesystem: 'File System',
  database: 'Database',
  network: 'Network Request',
  auth: 'Authentication / Crypto',
  os: 'OS Command'
};

const TYPE_COLORS = {
  filesystem: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  database: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  network: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  auth: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  os: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
};

export const SecurityPathsPanel: React.FC<{
  onFocusNode?: (nodeId: string) => void;
}> = ({ onFocusNode }) => {
  const { graph, taintSinks, clearTaintHighlights, setRightPanelTab } = useAppState();

  const groupedSinks = useMemo(() => {
    const groups: Record<string, SinkMatch[]> = {
      os: [],
      auth: [],
      database: [],
      filesystem: [],
      network: []
    };
    
    taintSinks.forEach(sink => {
      if (groups[sink.type]) {
        groups[sink.type].push(sink);
      }
    });

    return groups;
  }, [taintSinks]);

  if (taintSinks.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-border-subtle flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-text-muted opacity-50" />
        </div>
        <h3 className="text-sm font-medium text-text-primary mb-2">No Active Trace</h3>
        <p className="text-xs text-text-muted max-w-[250px] leading-relaxed">
          Select a node in the graph and click <strong>Trace Flow</strong> in the Code Inspector to see its security paths here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1c1c1c] bg-[#0a0a0a] flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-[13px] font-semibold text-[#ededed]">Security Paths</h3>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase tracking-widest">
              {taintSinks.length} Sinks Detected
            </span>
          </div>
          <p className="text-[11px] text-[#52525b] leading-relaxed pr-4">
            Data flowing from the selected node reaches these potentially sensitive sinks.
          </p>
        </div>
        <button 
          onClick={() => { clearTaintHighlights(); setRightPanelTab('chat'); }}
          className="p-1 hover:bg-white/5 rounded text-[#52525b] hover:text-[#ededed] transition-colors"
          title="Clear trace and close"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {Object.keys(groupedSinks).map(typeKey => {
          const type = typeKey as SinkMatch['type'];
          const sinks = groupedSinks[type];
          if (sinks.length === 0) return null;
          
          const Icon = TYPE_ICONS[type];
          
          return (
            <div key={type} className="animate-fade-in">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Icon className={`w-3.5 h-3.5 ${TYPE_COLORS[type].split(' ')[0]}`} />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa]">{TYPE_LABELS[type]}</h4>
                <div className="h-px flex-1 bg-[#1c1c1c] ml-2" />
              </div>
              
              <div className="space-y-2">
                {sinks.map((sink, i) => (
                  <div key={`${sink.node.id}-${i}`} className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg overflow-hidden group">
                    <div 
                      className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => onFocusNode?.(sink.node.id)}
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <code className={`text-[11px] px-1.5 py-0.5 rounded font-bold border ${TYPE_COLORS[type]} whitespace-nowrap`}>
                            {sink.node.label}
                          </code>
                          <span className="text-[12px] font-medium text-[#ededed] truncate">{sink.node.properties.name}</span>
                        </div>
                        <div className="text-[10px] text-[#52525b] font-mono truncate">
                          {sink.node.properties.filePath || 'Unknown file'}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#3f3f46] group-hover:text-accent transition-colors flex-shrink-0" />
                    </div>
                    
                    {/* Path details */}
                    <div className="px-3 py-2 bg-[#050505] border-t border-[#1c1c1c]/50 text-[10px] font-mono text-[#52525b]">
                      <span className="text-accent/70 font-semibold mb-1 block uppercase tracking-widest text-[9px]">Flow Path:</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {sink.path.map((stepId, idx) => {
                          const stepNode = graph?.getNode(stepId);
                          const isLast = idx === sink.path.length - 1;
                          return (
                            <React.Fragment key={`${stepId}-${idx}`}>
                              <span className={isLast ? 'text-rose-400 font-bold' : 'text-[#a1a1aa]'}>
                                {stepNode?.properties.name || stepId}
                              </span>
                              {!isLast && <span className="text-[#3f3f46]">→</span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
