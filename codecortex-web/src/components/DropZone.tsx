import { useState, useCallback, useRef, DragEvent } from 'react';
import { Upload, FileArchive, Github, Loader2, ArrowRight, Key, Eye, EyeOff, Globe, X, Zap, Shield, BarChart3 } from 'lucide-react';
import { cloneRepository, parseGitHubUrl } from '../services/git-clone';
import { connectToServer, type ConnectToServerResult } from '../services/server-connection';
import { FileEntry } from '../services/zip';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  onGitClone?: (files: FileEntry[]) => void;
  onServerConnect?: (result: ConnectToServerResult, serverUrl?: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DropZone = ({ onFileSelect, onGitClone, onServerConnect }: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'zip' | 'github' | 'server'>('zip');
  const [githubUrl, setGithubUrl] = useState('https://github.com/meghal86/smart-stake');
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState({ phase: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);

  const [serverUrl, setServerUrl] = useState(() =>
    localStorage.getItem('codecortex-server-url') || ''
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [serverProgress, setServerProgress] = useState<{
    phase: string;
    downloaded: number;
    total: number | null;
  }>({ phase: '', downloaded: 0, total: null });
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.zip')) {
        onFileSelect(file);
      } else {
        setError('Please drop a .zip file');
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.zip')) {
        onFileSelect(file);
      } else {
        setError('Please select a .zip file');
      }
    }
  }, [onFileSelect]);

  const handleGitClone = async () => {
    if (!githubUrl.trim()) { setError('Please enter a GitHub URL'); return; }
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) { setError('Invalid GitHub URL. Use format: https://github.com/owner/repo'); return; }
    setError(null);
    setIsCloning(true);
    setCloneProgress({ phase: 'starting', percent: 0 });
    try {
      const files = await cloneRepository(
        githubUrl,
        (phase, percent) => setCloneProgress({ phase, percent }),
        githubToken || undefined
      );
      setGithubToken('');
      if (!files || files.length === 0) throw new Error('Repository is empty or contains no readable text files.');
      if (onGitClone) onGitClone(files);
    } catch (err) {
      console.error('Clone failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to clone repository';
      if (message.includes('401') || message.includes('403') || message.includes('Authentication')) {
        setError(!githubToken ? 'Private repo detected. Add a GitHub PAT.' : 'Auth failed. Check token permissions.');
      } else if (message.includes('404') || message.includes('not found') || message.includes('Failed to fetch')) {
        setError('Repository not found. Check the URL or add a PAT.');
      } else {
        setError(message);
      }
    } finally {
      setIsCloning(false);
    }
  };

  const handleServerConnect = async () => {
    const urlToUse = serverUrl.trim() || 'http://localhost:3030';
    if (!urlToUse) { setError('Please enter a server URL'); return; }
    localStorage.setItem('codecortex-server-url', serverUrl);
    setError(null);
    setIsConnecting(true);
    setServerProgress({ phase: 'validating', downloaded: 0, total: null });
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const result = await connectToServer(
        urlToUse,
        (phase, downloaded, total) => setServerProgress({ phase, downloaded, total }),
        abortController.signal
      );
      if (onServerConnect) onServerConnect(result, urlToUse);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Server connect failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to connect to server';
      setError(message.includes('Failed to fetch') || message.includes('NetworkError')
        ? 'Cannot reach server. Check URL and ensure server is running.'
        : message
      );
    } finally {
      setIsConnecting(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelConnect = () => {
    abortControllerRef.current?.abort();
    setIsConnecting(false);
  };

  const serverProgressPercent = serverProgress.total
    ? Math.round((serverProgress.downloaded / serverProgress.total) * 100)
    : null;

  const tabs = [
    { id: 'zip' as const, label: 'Upload', icon: FileArchive },
    { id: 'github' as const, label: 'GitHub', icon: Github },
    { id: 'server' as const, label: 'Server', icon: Globe },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#000] relative overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Subtle radial gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.06)_0%,_transparent_70%)]" />

      <div className="relative z-10 w-full max-w-[460px] px-6">

        {/* ── BRAND ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.06] border border-white/[0.08] mb-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-lg text-white font-bold select-none">◈</span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#ededed] mb-3">
            CodeCortex
          </h1>
          <p className="text-[14px] text-[#71717a] leading-relaxed max-w-[340px] mx-auto">
            Architecture intelligence for engineering teams.
            Map, understand, and evolve your codebase.
          </p>
        </div>

        {/* ── FEATURE PILLS ── */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { icon: Zap, label: 'Live Graph' },
            { icon: Shield, label: 'Debt Scanner' },
            { icon: BarChart3, label: 'Analytics' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-[#52525b]">
              <Icon className="w-3 h-3" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* ── TAB SWITCHER ── */}
        <div className="flex mb-5 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                activeTab === id
                  ? 'bg-[#1a1a1a] text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-[#52525b] hover:text-[#a1a1aa]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-lg text-[12px] text-red-400 text-center">
            {error}
          </div>
        )}

        {/* ── ZIP UPLOAD ── */}
        {activeTab === 'zip' && (
          <div
            className={`relative p-10 border rounded-lg cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'bg-[#3b82f6]/[0.04] border-[#3b82f6]/40'
                : 'bg-[#0a0a0a] border-[#1c1c1c] hover:border-[#303030]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input id="file-input" type="file" accept=".zip" className="hidden" onChange={handleFileInput} />

            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 mb-4 rounded-lg flex items-center justify-center transition-all ${
                isDragging ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-white/[0.04] text-[#52525b]'
              }`}>
                {isDragging ? <Upload className="w-5 h-5" /> : <FileArchive className="w-5 h-5" />}
              </div>
              <p className="text-[14px] font-medium text-[#ededed] mb-1">
                {isDragging ? 'Drop here' : 'Drop your codebase'}
              </p>
              <p className="text-[12px] text-[#52525b] mb-4">
                or click to browse · .zip files only
              </p>
            </div>
          </div>
        )}

        {/* ── GITHUB CLONE ── */}
        {activeTab === 'github' && (
          <div className="space-y-3">
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isCloning && githubUrl.trim() && handleGitClone()}
              placeholder="https://github.com/owner/repo"
              disabled={isCloning}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg text-[13px] text-[#ededed] placeholder:text-[#3f3f46] outline-none transition-all focus:border-[#3b82f6]/50 focus:ring-2 focus:ring-[#3b82f6]/10 disabled:opacity-40"
            />

            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3f3f46]" />
              <input
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="PAT (optional, for private repos)"
                disabled={isCloning}
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                className="w-full h-10 pl-9 pr-9 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg text-[13px] text-[#ededed] placeholder:text-[#3f3f46] outline-none transition-all focus:border-[#3b82f6]/50 focus:ring-2 focus:ring-[#3b82f6]/10 disabled:opacity-40"
              />
              <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3f3f46] hover:text-[#71717a] transition-colors">
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={handleGitClone}
              disabled={isCloning || !githubUrl.trim()}
              className="w-full h-10 flex items-center justify-center gap-2 bg-[#ededed] hover:bg-white text-[#000] text-[13px] font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{cloneProgress.phase === 'cloning' ? `Cloning ${cloneProgress.percent}%` : cloneProgress.phase === 'reading' ? 'Reading...' : 'Starting...'}</span>
                </>
              ) : (
                <>
                  <span>Clone Repository</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {isCloning && (
              <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
                <div className="h-full bg-[#3b82f6] transition-all duration-300" style={{ width: `${cloneProgress.percent}%` }} />
              </div>
            )}

            {githubToken && (
              <p className="text-[10px] text-[#3f3f46] text-center">Token stays in your browser. Never sent to any server.</p>
            )}
          </div>
        )}

        {/* ── SERVER CONNECT ── */}
        {activeTab === 'server' && (
          <div className="space-y-3">
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isConnecting && handleServerConnect()}
              placeholder={window.location.origin}
              disabled={isConnecting}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg text-[13px] text-[#ededed] placeholder:text-[#3f3f46] outline-none transition-all focus:border-[#3b82f6]/50 focus:ring-2 focus:ring-[#3b82f6]/10 disabled:opacity-40"
            />

            <div className="flex gap-2">
              <button
                onClick={handleServerConnect}
                disabled={isConnecting}
                className="flex-1 h-10 flex items-center justify-center gap-2 bg-[#ededed] hover:bg-white text-[#000] text-[13px] font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{
                      serverProgress.phase === 'validating' ? 'Validating...'
                      : serverProgress.phase === 'downloading'
                        ? serverProgressPercent !== null ? `${serverProgressPercent}%` : formatBytes(serverProgress.downloaded)
                      : serverProgress.phase === 'extracting' ? 'Processing...'
                      : 'Connecting...'
                    }</span>
                  </>
                ) : (
                  <>
                    <span>Connect</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {isConnecting && (
                <button onClick={handleCancelConnect} className="h-10 px-3 bg-[#1a1a1a] hover:bg-[#222] text-[#a1a1aa] rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {isConnecting && serverProgress.phase === 'downloading' && (
              <div>
                <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-[#3b82f6] transition-all duration-300 ${serverProgressPercent === null ? 'animate-pulse' : ''}`}
                    style={{ width: serverProgressPercent !== null ? `${serverProgressPercent}%` : '100%' }}
                  />
                </div>
                {serverProgress.total && (
                  <p className="mt-1 text-[10px] text-[#3f3f46] text-center">{formatBytes(serverProgress.downloaded)} / {formatBytes(serverProgress.total)}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── KEYBOARD SHORTCUT HINT ── */}
        <div className="flex items-center justify-center gap-6 mt-8 text-[10px] text-[#3f3f46]">
          <span>Press <kbd className="mx-1 px-1.5 py-0.5 bg-[#141414] border border-[#222] rounded text-[10px] font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">⌘K</kbd> to search</span>
        </div>

        {/* ── FOOTER ── */}
        <div className="text-center mt-6">
          <p className="text-[10px] text-[#27272a]">
            v2.0 · Architecture Intelligence Engine
          </p>
        </div>
      </div>
    </div>
  );
};
