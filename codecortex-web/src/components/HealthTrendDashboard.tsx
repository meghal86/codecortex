import React, { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Activity, X, Info } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { fetchHealthHistory } from '../services/backend';

export const HealthTrendDashboard: React.FC = () => {
  const { isHealthTrendOpen, setHealthTrendOpen, projectName } = useAppState();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHealthTrendOpen || !projectName) return;
    
    let isMounted = true;
    setLoading(true);
    fetchHealthHistory(projectName)
      .then((history) => {
        if (!isMounted) return;
        
        // Format dates for the chart
        const formatted = history.map((item: any) => ({
          ...item,
          shortDate: new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        }));
        
        setData(formatted);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load health history');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [isHealthTrendOpen, projectName]);

  if (!isHealthTrendOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] bg-[#0a0a0a] border border-[#1c1c1c] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#ededed]">Architecture Health Dashboard</h2>
              <p className="text-[11px] text-[#52525b]">
                Historical trends of codebase coupling, dead code, and cohesion over time
              </p>
            </div>
          </div>
          <button onClick={() => setHealthTrendOpen(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/[0.05] text-[#52525b] hover:text-[#ededed] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#050505] scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-[#52525b]">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[12px]">Loading historical data...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400 text-[13px]">
              {error}. (Run `codecortex analyze` to generate snapshots).
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#52525b]">
              <Activity className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-[13px] text-[#ededed]">No health data available yet.</p>
              <p className="text-[11px] mt-2">Run `codecortex analyze` locally on multiple commits to populate history.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 pb-12">
              
              {/* Coupling Chart */}
              <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-medium text-[#ededed]">Average Coupling Score</h3>
                  <div className="text-[10px] text-[#52525b] flex items-center gap-1">
                    <Info className="w-3 h-3" /> Lower is better
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                      <XAxis dataKey="shortDate" stroke="#52525b" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#52525b" fontSize={10} width={30} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '6px' }} 
                        itemStyle={{ color: '#ededed', fontSize: '11px' }}
                        labelStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                      />
                      <Line type="monotone" dataKey="couplingScore" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dead Code Chart */}
              <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-medium text-[#ededed]">Dead Code %</h3>
                  <div className="text-[10px] text-[#52525b] flex items-center gap-1">
                    <Info className="w-3 h-3" /> Lower is better
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                      <XAxis dataKey="shortDate" stroke="#52525b" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#52525b" fontSize={10} width={30} tickFormatter={(val) => `${val}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '6px' }} 
                        itemStyle={{ color: '#ededed', fontSize: '11px' }}
                        labelStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                        formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Dead Code']}
                      />
                      <Line type="monotone" dataKey="deadCodePct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Community Cohesion Chart */}
              <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-medium text-[#ededed]">Module Cohesion Average</h3>
                  <div className="text-[10px] text-[#52525b] flex items-center gap-1">
                    <Info className="w-3 h-3" /> Higher is better
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                      <XAxis dataKey="shortDate" stroke="#52525b" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#52525b" fontSize={10} width={30} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '6px' }} 
                        itemStyle={{ color: '#ededed', fontSize: '11px' }}
                        labelStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                        formatter={(val: any) => [Number(val).toFixed(3), 'Avg Cohesion']}
                      />
                      <Line type="monotone" dataKey="cohesionAvg" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Circular Deps Chart */}
              <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-medium text-[#ededed]">Circular Dependencies</h3>
                  <div className="text-[10px] text-[#52525b] flex items-center gap-1">
                    <Info className="w-3 h-3" /> Lower is better
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
                      <XAxis dataKey="shortDate" stroke="#52525b" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#52525b" fontSize={10} width={30} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #222', borderRadius: '6px' }} 
                        itemStyle={{ color: '#ededed', fontSize: '11px' }}
                        labelStyle={{ color: '#a1a1aa', fontSize: '10px' }}
                      />
                      <Line type="stepAfter" dataKey="circularDeps" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Bus Factor placeholder mapping - (omitted or kept default to 0 if no local git integration) */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
