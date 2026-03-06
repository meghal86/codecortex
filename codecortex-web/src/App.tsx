import { useState, useCallback, useEffect, useRef } from 'react';
import { init_graph, get_metrics } from 'codecortex';
import JSZip from 'jszip';
import './App.css';

interface FileEntry {
  path: string;
  content: string;
  size: number;
}

type ViewMode = 'onboarding' | 'loading' | 'exploring';

function App() {
  const [metrics, setMetrics] = useState<{ nodes: number; edges: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('onboarding');
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [projectName, setProjectName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize the Wasm Graph Memory Context
  useEffect(() => {
    try {
      console.log('Mounting CodeCortex WebAssembly Engine...');
      init_graph();
      const m = get_metrics() as { nodes: number; edges: number };
      setMetrics(m);
    } catch (e) {
      console.error('WASM init error:', e);
    }
  }, []);

  // ---------- Core Processing Pipeline ----------
  const processZipFile = useCallback(async (file: File) => {
    const name = file.name.replace(/\.zip$/i, '');
    setProjectName(name);
    setViewMode('loading');
    setProgress({ percent: 5, message: 'Extracting ZIP archive...' });

    try {
      const zip = await JSZip.loadAsync(file);
      const entries: FileEntry[] = [];
      const totalFiles = Object.keys(zip.files).length;
      let processed = 0;

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        // Skip binary / large files
        const ext = relativePath.split('.').pop()?.toLowerCase() || '';
        const textExtensions = [
          'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'kt', 'rb',
          'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'md', 'json', 'yaml', 'yml',
          'toml', 'xml', 'html', 'css', 'scss', 'sql', 'sh', 'bash', 'txt',
          'cfg', 'ini', 'env', 'dockerfile', 'makefile', 'gitignore', 'lock',
        ];
        const isText = textExtensions.includes(ext) || relativePath.toLowerCase().includes('dockerfile') || relativePath.toLowerCase().includes('makefile');

        if (isText) {
          try {
            const content = await zipEntry.async('string');
            entries.push({ path: relativePath, content, size: content.length });
          } catch {
            // Skip files that can't be read as text
          }
        }

        processed++;
        const pct = Math.round((processed / totalFiles) * 90) + 5;
        setProgress({ percent: pct, message: `Processing ${relativePath}...` });
      }

      setFiles(entries);

      // Update metrics
      const m = get_metrics() as { nodes: number; edges: number };
      setMetrics({ nodes: entries.length, edges: m?.edges || 0 });

      setProgress({ percent: 100, message: `Done! ${entries.length} files extracted.` });
      setTimeout(() => setViewMode('exploring'), 300);
    } catch (err) {
      console.error('ZIP processing error:', err);
      setProgress({ percent: 0, message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
      setTimeout(() => setViewMode('onboarding'), 3000);
    }
  }, []);

  // Process a folder (from drag-drop or webkitdirectory)
  const processFileList = useCallback(async (fileList: File[]) => {
    const name = fileList[0]?.webkitRelativePath?.split('/')[0] || 'repository';
    setProjectName(name);
    setViewMode('loading');
    setProgress({ percent: 5, message: 'Reading files...' });

    const entries: FileEntry[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = file.webkitRelativePath || file.name;

      // Skip hidden files and node_modules
      if (path.includes('node_modules/') || path.includes('.git/')) continue;

      try {
        const content = await file.text();
        entries.push({ path, content, size: content.length });
      } catch {
        // Skip binary files
      }

      const pct = Math.round((i / fileList.length) * 90) + 5;
      setProgress({ percent: pct, message: `Reading ${path}...` });
    }

    setFiles(entries);
    setMetrics({ nodes: entries.length, edges: 0 });
    setProgress({ percent: 100, message: `Done! ${entries.length} files loaded.` });
    setTimeout(() => setViewMode('exploring'), 300);
  }, []);

  // ---------- Drag & Drop Handlers ----------
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    // Check if it's a ZIP file
    const firstFile = droppedFiles[0];
    if (firstFile.name.endsWith('.zip')) {
      await processZipFile(firstFile);
      return;
    }

    // Otherwise treat as folder drop
    const fileArray = Array.from(droppedFiles);
    await processFileList(fileArray);
  }, [processZipFile, processFileList]);

  // ---------- Click to Browse ----------
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (!inputFiles || inputFiles.length === 0) return;

    const firstFile = inputFiles[0];
    if (firstFile.name.endsWith('.zip')) {
      await processZipFile(firstFile);
    } else {
      await processFileList(Array.from(inputFiles));
    }
  }, [processZipFile, processFileList]);

  // ========== VIEWS ==========

  // --- Loading View ---
  if (viewMode === 'loading') {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="progress-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" className="progress-bg" />
              <circle
                cx="60" cy="60" r="54"
                className="progress-fill"
                strokeDasharray={`${progress.percent * 3.39} 339.292`}
              />
            </svg>
            <span className="progress-text">{progress.percent}%</span>
          </div>
          <p className="progress-message">{progress.message}</p>
        </div>
      </div>
    );
  }

  // --- Exploring View ---
  if (viewMode === 'exploring') {
    return (
      <div className="app-container">
        <header className="header">
          <h1>CodeCortex</h1>
          <span className="project-name">{projectName}</span>
          <div className="status-badge">
            {metrics?.nodes || 0} files • {metrics?.edges || 0} relationships
          </div>
          <button className="back-btn" onClick={() => { setViewMode('onboarding'); setFiles([]); setSelectedFile(null); }}>
            ← New Analysis
          </button>
        </header>

        <main className="explorer">
          <aside className="file-tree">
            <h3>Files ({files.length})</h3>
            <ul>
              {files.map((f) => (
                <li
                  key={f.path}
                  className={`file-item ${selectedFile?.path === f.path ? 'active' : ''}`}
                  onClick={() => setSelectedFile(f)}
                >
                  <span className="file-icon">📄</span>
                  <span className="file-name" title={f.path}>{f.path.split('/').pop()}</span>
                  <span className="file-size">{(f.size / 1024).toFixed(1)}k</span>
                </li>
              ))}
            </ul>
          </aside>

          <section className="code-viewer">
            {selectedFile ? (
              <>
                <div className="code-header">
                  <span>{selectedFile.path}</span>
                  <span className="line-count">{selectedFile.content.split('\n').length} lines</span>
                </div>
                <pre className="code-block">
                  <code>{selectedFile.content}</code>
                </pre>
              </>
            ) : (
              <div className="empty-state">
                <p>Select a file from the tree to view its contents</p>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // --- Onboarding / Drop Zone View ---
  return (
    <div
      className={`app-container ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="header">
        <h1>CodeCortex</h1>
        <div className="status-badge">
          WASM Engine Ready
        </div>
      </header>

      <main className="main-content">
        <div className={`dropzone ${isDragActive ? 'active' : ''}`} onClick={handleBrowseClick}>
          <svg className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <h2>{isDragActive ? 'Release to Analyze' : 'Drop Repository to Analyze'}</h2>
          <p>
            Drag a <strong>.zip</strong> file here, or <span className="browse-link">click to browse</span>
            <br />
            Analyzed 100% locally in <strong>WebAssembly</strong>. No data leaves your machine.
          </p>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
    </div>
  );
}

export default App;
