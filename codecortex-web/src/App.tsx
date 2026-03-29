import { useCallback, useEffect, useRef } from 'react';
import { AppStateProvider, useAppState } from './hooks/useAppState';
import { DropZone } from './components/DropZone';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Header } from './components/Header';
import { GraphCanvas, GraphCanvasHandle } from './components/GraphCanvas';
import { RightPanel } from './components/RightPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { FileTreePanel } from './components/FileTreePanel';
import { CodeReferencesPanel } from './components/CodeReferencesPanel';
import { HelpModal } from './components/HelpModal';
import { InsightsDashboard } from './components/InsightsDashboard';
import { EnterprisePanel } from './components/EnterprisePanel';
import { DeadCodeReport } from './components/DeadCodeReport';
import { HealthTrendDashboard } from './components/HealthTrendDashboard';
import { FileEntry } from './services/zip';
import { getActiveProviderConfig } from './core/llm/settings-service';
import { createKnowledgeGraph } from './core/graph/graph';
import { connectToServer, fetchRepos, normalizeServerUrl, type ConnectToServerResult } from './services/server-connection';
import { TimelineScrubber } from './components/TimelineScrubber';
import { getMockCommits } from './core/ingestion/git-processor';
import { GraphStatsBar } from './components/GraphStatsBar';

const AppContent = () => {
  const {
    viewMode,
    setViewMode,
    graph,
    setGraph,
    setFileContents,
    setProgress,
    setProjectName,
    progress,
    isRightPanelOpen,
    runPipeline,
    runPipelineFromFiles,
    isSettingsPanelOpen,
    setSettingsPanelOpen,
    isHelpModalOpen,
    setHelpModalOpen,
    refreshLLMSettings,
    initializeAgent,
    startEmbeddings,
    embeddingStatus,
    codeReferences,
    selectedNode,
    isCodePanelOpen,
    serverBaseUrl,
    setServerBaseUrl,
    availableRepos,
    setAvailableRepos,
    switchRepo,
    setCommits,
    setSelectedCommitId,
    selectedCommitId,
    commits,
    projectName,
    isDeadCodeOpen,
    setDeadCodeOpen,
    isHealthTrendOpen,
    setHealthTrendOpen
  } = useAppState();

  const graphCanvasRef = useRef<GraphCanvasHandle>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    const projectName = file.name.replace('.zip', '');
    setProjectName(projectName);
    setProgress({ phase: 'extracting', percent: 0, message: 'Starting...', detail: 'Preparing to extract files' });
    setViewMode('loading');

    try {
      const result = await runPipeline(file, (progress) => {
        setProgress(progress);
      });

      setGraph(result.graph);
      setFileContents(result.fileContents);
      setViewMode('exploring');

      // Initialize (or re-initialize) the agent AFTER a repo loads so it captures
      // the current codebase context (file contents + graph tools) in the worker.
      if (getActiveProviderConfig()) {
        try {
          initializeAgent(projectName);
        } catch (e) {
          console.warn('Failed to initialize agent:', e);
        }
      }

      // Auto-start embeddings pipeline in background
      // Uses WebGPU if available, falls back to WASM
      startEmbeddings().catch((err) => {
        if (err?.name === 'WebGPUNotAvailableError' || err?.message?.includes('WebGPU')) {
          startEmbeddings('wasm').catch(console.warn);
        } else {
          console.warn('Embeddings auto-start failed:', err);
        }
      });

      // Timeline: skip mock commits — will be connected to real git data later
      // const mCommits = getMockCommits(projectName);
      // setCommits(mCommits);
      // setSelectedCommitId(mCommits[mCommits.length - 1].id);
    } catch (error) {
      console.error('Pipeline error:', error);
      setProgress({
        phase: 'error',
        percent: 0,
        message: 'Error processing file',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
      setTimeout(() => {
        setViewMode('onboarding');
        setProgress(null);
      }, 8000);
    }
  }, [setViewMode, setGraph, setFileContents, setProgress, setProjectName, runPipeline, startEmbeddings, initializeAgent]);

  const handleGitClone = useCallback(async (files: FileEntry[]) => {
    const firstPath = files[0]?.path || 'repository';
    const projectName = firstPath.split('/')[0].replace(/-\d+$/, '') || 'repository';

    setProjectName(projectName);
    setProgress({ phase: 'extracting', percent: 0, message: 'Starting...', detail: 'Preparing to process files' });
    setViewMode('loading');

    try {
      const result = await runPipelineFromFiles(files, (progress) => {
        setProgress(progress);
      });

      setGraph(result.graph);
      setFileContents(result.fileContents);
      setViewMode('exploring');

      if (getActiveProviderConfig()) {
        try {
          initializeAgent(projectName);
        } catch (e) {
          console.warn('Failed to initialize agent:', e);
        }
      }

      startEmbeddings().catch((err) => {
        if (err?.name === 'WebGPUNotAvailableError' || err?.message?.includes('WebGPU')) {
          startEmbeddings('wasm').catch(console.warn);
        } else {
          console.warn('Embeddings auto-start failed:', err);
        }
      });

      // Timeline: skip mock commits — will be connected to real git data later
      // const mCommits = getMockCommits(projectName);
      // setCommits(mCommits);
      // setSelectedCommitId(mCommits[mCommits.length - 1].id);
    } catch (error) {
      console.error('Pipeline error:', error);
      setProgress({
        phase: 'error',
        percent: 0,
        message: 'Error processing repository',
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
      setTimeout(() => {
        setViewMode('onboarding');
        setProgress(null);
      }, 8000);
    }
  }, [setViewMode, setGraph, setFileContents, setProgress, setProjectName, runPipelineFromFiles, startEmbeddings, initializeAgent]);

  const handleServerConnect = useCallback((result: ConnectToServerResult) => {
    // Extract project name from repoPath
    const repoPath = result.repoInfo.repoPath;
    const projectName = repoPath.split('/').pop() || 'server-project';
    setProjectName(projectName);

    // Build KnowledgeGraph from server data (bypasses WASM pipeline entirely)
    const graph = createKnowledgeGraph();
    for (const node of result.nodes) {
      graph.addNode(node);
    }
    for (const rel of result.relationships) {
      graph.addRelationship(rel);
    }
    setGraph(graph);

    // Set file contents from extracted File node content
    const fileMap = new Map<string, string>();
    for (const [path, content] of Object.entries(result.fileContents)) {
      fileMap.set(path, content);
    }
    setFileContents(fileMap);

    // Transition directly to exploring view
    setViewMode('exploring');

    // Initialize agent if LLM is configured
    if (getActiveProviderConfig()) {
      try {
        initializeAgent(projectName);
      } catch (e) {
        console.warn('Failed to initialize agent:', e);
      }
    }

    // Auto-start embeddings
    startEmbeddings().catch((err) => {
      if (err?.name === 'WebGPUNotAvailableError' || err?.message?.includes('WebGPU')) {
        startEmbeddings('wasm').catch(console.warn);
      } else {
        console.warn('Embeddings auto-start failed:', err);
      }
    });

    // Timeline: skip mock commits — will be connected to real git data later
    // const mCommits = getMockCommits(projectName);
    // setCommits(mCommits);
    // setSelectedCommitId(mCommits[mCommits.length - 1].id);
  }, [setViewMode, setGraph, setFileContents, setProjectName, initializeAgent, startEmbeddings, setCommits, setSelectedCommitId]);

  // Auto-connect when ?server query param is present (bookmarkable shortcut)
  const autoConnectRan = useRef(false);
  useEffect(() => {
    if (autoConnectRan.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('server')) return;
    autoConnectRan.current = true;

    // Clean the URL so a refresh won't re-trigger
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);

    setProgress({ phase: 'extracting', percent: 0, message: 'Connecting to server...', detail: 'Validating server' });
    setViewMode('loading');

    const serverUrl = params.get('server') || window.location.origin;

    const baseUrl = normalizeServerUrl(serverUrl);

    connectToServer(serverUrl, (phase, downloaded, total) => {
      if (phase === 'validating') {
        setProgress({ phase: 'extracting', percent: 5, message: 'Connecting to server...', detail: 'Validating server' });
      } else if (phase === 'downloading') {
        const pct = total ? Math.round((downloaded / total) * 90) + 5 : 50;
        const mb = (downloaded / (1024 * 1024)).toFixed(1);
        setProgress({ phase: 'extracting', percent: pct, message: 'Downloading graph...', detail: `${mb} MB downloaded` });
      } else if (phase === 'extracting') {
        setProgress({ phase: 'extracting', percent: 97, message: 'Processing...', detail: 'Extracting file contents' });
      }
    }).then(async (result) => {
      handleServerConnect(result);

      // Store server URL and fetch available repos for the repo switcher
      setServerBaseUrl(baseUrl);
      try {
        const repos = await fetchRepos(baseUrl);
        setAvailableRepos(repos);
      } catch (e) {
        console.warn('Failed to fetch repo list:', e);
      }
    }).catch((err) => {
      console.error('Auto-connect failed:', err);
      setProgress({
        phase: 'error',
        percent: 0,
        message: 'Failed to connect to server',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
      setTimeout(() => {
        setViewMode('onboarding');
        setProgress(null);
      }, 8000);
    });
  }, [handleServerConnect, setProgress, setViewMode, setServerBaseUrl, setAvailableRepos]);

  const handleFocusNode = useCallback((nodeId: string) => {
    graphCanvasRef.current?.focusNode(nodeId);
  }, []);

  // Handle settings saved - refresh and reinitialize agent
  // NOTE: Must be defined BEFORE any conditional returns (React hooks rule)
  const handleSettingsSaved = useCallback(() => {
    refreshLLMSettings();
    initializeAgent();
  }, [refreshLLMSettings, initializeAgent]);
  // --- PHASE 6: MOCK EVOLUTION DRIFT ---
  useEffect(() => {
    if (!graph || !selectedCommitId || !commits.length) return;

    const selectedIndex = commits.findIndex(c => c.id === selectedCommitId);
    if (selectedIndex === -1) return;

    // Simulate "drift" by hiding nodes that were "added" after the selected commit
    // (Simplified mock logic: nodes are hidden based on a stable index-based heuristic)
    const updatedNodes = graph.nodes.map((node: any, idx: number) => {
      // Hide ~20% of nodes for each commit back in time
      const nodeCreationIndex = (idx * 13) % (commits.length + 1);
      const isVisibleInSelectedCommit = nodeCreationIndex <= selectedIndex + 1;

      return {
        ...node,
        properties: {
          ...node.properties,
          hidden: !isVisibleInSelectedCommit,
        }
      };
    });

    // Also hide edges connected to hidden nodes
    const updatedRelationships = graph.relationships.map((rel: any) => {
      const source = updatedNodes.find((n: any) => n.id === rel.sourceId);
      const target = updatedNodes.find((n: any) => n.id === rel.targetId);
      return {
        ...rel,
        hidden: source?.properties.hidden || target?.properties.hidden,
      };
    });

    // We create a new graph object to trigger React/Sigma re-render
    const newGraph = createKnowledgeGraph();
    updatedNodes.forEach((n: any) => newGraph.addNode(n));
    updatedRelationships.forEach((r: any) => newGraph.addRelationship(r));

    setGraph(newGraph);
  }, [selectedCommitId, commits, setGraph]);

  // Render based on view mode
  if (viewMode === 'onboarding') {
    return (
      <DropZone
        onFileSelect={handleFileSelect}
        onGitClone={handleGitClone}
        onServerConnect={async (result, serverUrl) => {
          handleServerConnect(result);
          if (serverUrl) {
            const baseUrl = normalizeServerUrl(serverUrl);
            setServerBaseUrl(baseUrl);
            try {
              const repos = await fetchRepos(baseUrl);
              setAvailableRepos(repos);
            } catch (e) {
              console.warn('Failed to fetch repo list:', e);
            }
          }
        }}
      />
    );
  }

  if (viewMode === 'loading' && progress) {
    return <LoadingOverlay progress={progress} />;
  }

  // Exploring view
  return (
    <div className="flex flex-col h-screen w-screen bg-[#000] text-[#ededed] overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top Navigation Bar */}
      <Header onFocusNode={handleFocusNode} availableRepos={availableRepos} onSwitchRepo={switchRepo} />

      {/* Main Work Area (Left Panel, Center Graph, Right Panels) */}
      <main className="flex-1 flex min-h-0 overflow-hidden border-t border-[#1c1c1c]">
        
        {/* Left Side: Navigation / File Tree */}
        <FileTreePanel onFocusNode={handleFocusNode} />

        {/* Center: Interactive Knowledge Graph */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-[#050505]">
          <GraphStatsBar />
          <div className="flex-1 relative min-w-0">
            <GraphCanvas ref={graphCanvasRef} />
          </div>
        </div>

        {/* Right Side: Code Context & Insights Chat */}
        {isCodePanelOpen && (codeReferences.length > 0 || !!selectedNode) && (
          <div className="border-l border-[#1c1c1c] flex-shrink-0">
             <CodeReferencesPanel onFocusNode={handleFocusNode} />
          </div>
        )}

        {isRightPanelOpen && (
          <div className="border-l border-[#1c1c1c] flex-shrink-0">
             <RightPanel />
          </div>
        )}

      </main>

      {/* Bottom Status Bar */}
      <div className="border-t border-[#1c1c1c] bg-[#000]">
        <StatusBar />
      </div>

      {/* Global Interactive Overlays */}
      {viewMode === 'exploring' && (
        <>
          {commits.length > 0 && <TimelineScrubber />}
          <InsightsDashboard />
          <EnterprisePanel />
          <DeadCodeReport
            isOpen={isDeadCodeOpen}
            onClose={() => setDeadCodeOpen(false)}
            onFocusNode={handleFocusNode}
          />
        </>
      )}

      {/* Settings Panel (modal) */}
      <SettingsPanel
        isOpen={isSettingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      {/* Health Trend Dashboard */}
      <HealthTrendDashboard />

    </div>
  );
};

function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;
