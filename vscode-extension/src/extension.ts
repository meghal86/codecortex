/**
 * CodeCortex VS Code Extension
 * 
 * Provides blast radius hints and architectural guardrails
 * directly in the IDE.
 */

import * as vscode from 'vscode';

interface BlastRadiusInfo {
  symbol: string;
  callers: number;
  depth: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  affectedProcesses: string[];
}

interface Violation {
  rule: string;
  description: string;
  severity: 'error' | 'warning';
  location: string;
  suggestion?: string;
}

let statusBarItem: vscode.StatusBarItem;
let blastRadiusDecorationType: vscode.TextEditorDecorationType;
let serverConnected: boolean = false;
let lastConnectionCheck: number = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

interface FinOpsIssue {
  severity: string;
  category: string;
  title: string;
  description: string;
  file?: string;
  suggestion?: string;
}

class FinOpsTreeDataProvider implements vscode.TreeDataProvider<FinOpsIssue> {
  private _onDidChangeTreeData: vscode.EventEmitter<FinOpsIssue | undefined | null | void> = new vscode.EventEmitter<FinOpsIssue | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<FinOpsIssue | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private issues: FinOpsIssue[] = [];
  
  refresh(issues: FinOpsIssue[]): void {
    this.issues = issues;
    this._onDidChangeTreeData.fire();
  }
  
  getTreeItem(element: FinOpsIssue): vscode.TreeItem {
    const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
    item.description = `${element.severity} - ${element.category}`;
    item.tooltip = element.description;
    item.iconPath = this.getSeverityIcon(element.severity);
    
    if (element.file) {
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(element.file)]
      };
    }
    
    return item;
  }
  
  getChildren(element?: FinOpsIssue): vscode.ProviderResult<FinOpsIssue[]> {
    if (element) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this.issues);
  }
  
  private getSeverityIcon(severity: string): vscode.ThemeIcon {
    switch (severity) {
      case 'critical': return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      case 'high': return new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
      case 'medium': return new vscode.ThemeIcon('info', new vscode.ThemeColor('foreground'));
      case 'low': return new vscode.ThemeIcon('check', new vscode.ThemeColor('foreground'));
      default: return new vscode.ThemeIcon('circle-outline');
    }
  }
  
  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

let finopsDataProvider: FinOpsTreeDataProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeCortex extension activated');
  
  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'codecortex.showBlastRadius';
  statusBarItem.text = '$(graph) CodeCortex';
  statusBarItem.tooltip = 'Click to analyze blast radius';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  
  // Register FinOps tree view
  finopsDataProvider = new FinOpsTreeDataProvider();
  vscode.window.registerTreeDataProvider('codecortex.finops', finopsDataProvider);
  context.subscriptions.push(finopsDataProvider);
  
  // Create decoration type for inline hints
  blastRadiusDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 1em',
      fontStyle: 'italic',
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
    },
  });
  context.subscriptions.push(blastRadiusDecorationType);
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codecortex.analyzeImpact', analyzeImpact)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('codecortex.checkGuardrails', checkGuardrails)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('codecortex.showBlastRadius', showBlastRadius)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('codecortex.detectFinOps', detectFinOps)
  );
  
  // Auto-analyze on file open
  if (vscode.workspace.getConfiguration('codecortex').get('autoAnalyze', true)) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          analyzeCurrentFile(editor);
        }
      })
    );
    
    // Analyze current file on activation
    if (vscode.window.activeTextEditor) {
      analyzeCurrentFile(vscode.window.activeTextEditor);
    }
  }
  
  // Show inline hints on cursor move
  if (vscode.workspace.getConfiguration('codecortex').get('showInlineHints', true)) {
    context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor) {
          updateInlineHints(event.textEditor);
        }
      })
    );
  }
}

/**
 * Analyze impact of current file
 */
async function analyzeCurrentFile(editor: vscode.TextEditor) {
  const filePath = editor.document.fileName;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  
  if (!workspaceFolder) {
    return;
  }
  
  // Check connectivity before making request
  const isConnected = await checkServerConnectivity();
  if (!isConnected) {
    return; // Status bar already updated by checkServerConnectivity
  }
  
  try {
    // Call CodeCortex server to get impact analysis
    const response = await callCodeCortexServer('impact', {
      target: filePath,
      direction: 'upstream',
      maxDepth: 3,
    });
    
    if (response && response.risk) {
      updateStatusBar(response.risk, response.summary);
    }
  } catch (error: any) {
    // Silently fail for auto-analysis to avoid spamming user with errors
    // Status bar already shows connection status
    console.error('CodeCortex: Failed to analyze file', error.message || error);
  }
}

/**
 * Update inline hints for current cursor position
 */
async function updateInlineHints(editor: vscode.TextEditor) {
  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line);
  const text = line.text;
  
  // Extract symbol name at cursor
  const symbolMatch = text.match(/(?:function|class|const|let|var)\s+(\w+)/);
  if (!symbolMatch) {
    return;
  }
  
  const symbolName = symbolMatch[1];
  
  // Check connectivity before making request (with caching)
  const isConnected = await checkServerConnectivity();
  if (!isConnected) {
    return; // Silently fail for inline hints
  }
  
  try {
    // Get blast radius for this symbol
    const response = await callCodeCortexServer('impact', {
      target: symbolName,
      direction: 'upstream',
      maxDepth: 2,
    });
    
    if (response && response.callers > 0) {
      const decorations: vscode.DecorationOptions[] = [];
      
      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(position.line, line.range.end.character, position.line, line.range.end.character),
        renderOptions: {
          after: {
            contentText: ` 👥 ${response.callers} callers | 📊 Depth ${response.depth} | ${getRiskEmoji(response.risk)} ${response.risk.toUpperCase()}`,
          },
        },
      };
      
      decorations.push(decoration);
      editor.setDecorations(blastRadiusDecorationType, decorations);
    }
  } catch (error: any) {
    // Silently fail for inline hints - server might not be running
    // Status bar already shows connection status
    console.error('CodeCortex: Failed to update inline hints', error.message || error);
  }
}

/**
 * Analyze impact command
 */
async function analyzeImpact() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }
  
  const symbolName = await getSymbolAtCursor(editor);
  if (!symbolName) {
    vscode.window.showWarningMessage('No symbol found at cursor');
    return;
  }
  
  // Check connectivity before making request
  const isConnected = await checkServerConnectivity();
  if (!isConnected) {
    vscode.window.showErrorMessage(
      'CodeCortex: Cannot connect to server. Please ensure the CodeCortex server is running.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'codecortex.serverUrl');
      }
    });
    return;
  }
  
  try {
    const response = await callCodeCortexServer('impact', {
      target: symbolName,
      direction: 'upstream',
      maxDepth: 3,
    });
    
    if (response) {
      showImpactWebview(response);
    }
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    vscode.window.showErrorMessage(
      `CodeCortex: Failed to analyze impact - ${errorMessage}`,
      'Retry'
    ).then(selection => {
      if (selection === 'Retry') {
        analyzeImpact();
      }
    });
  }
}

/**
 * Check guardrails command
 */
async function checkGuardrails() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }
  
  const filePath = editor.document.fileName;
  const symbolName = await getSymbolAtCursor(editor);
  
  // Check connectivity before making request
  const isConnected = await checkServerConnectivity();
  if (!isConnected) {
    vscode.window.showErrorMessage(
      'CodeCortex: Cannot connect to server. Please ensure the CodeCortex server is running.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'codecortex.serverUrl');
      }
    });
    return;
  }
  
  try {
    const response = await callCodeCortexServer('check_guardrails', {
      file_path: filePath,
      symbol_name: symbolName,
      change_type: 'modify_function',
    });
    
    if (response) {
      showGuardrailsWebview(response);
    }
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    vscode.window.showErrorMessage(
      `CodeCortex: Failed to check guardrails - ${errorMessage}`,
      'Retry'
    ).then(selection => {
      if (selection === 'Retry') {
        checkGuardrails();
      }
    });
  }
}

/**
 * Detect FinOps issues command
 */
async function detectFinOps() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }
  
  const filePath = editor.document.fileName;
  
  // Check connectivity before making request
  const isConnected = await checkServerConnectivity();
  if (!isConnected) {
    vscode.window.showErrorMessage(
      'CodeCortex: Cannot connect to server. Please ensure the CodeCortex server is running.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'codecortex.serverUrl');
      }
    });
    return;
  }
  
  try {
    const response = await callCodeCortexServer('detect_finops', {
      severity: 'all',
    });
    
    if (response) {
      showFinOpsWebview(response);
      // Also refresh the tree view
      if (finopsDataProvider && response.issues) {
        finopsDataProvider.refresh(response.issues);
      }
    }
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    vscode.window.showErrorMessage(
      `CodeCortex: Failed to detect FinOps issues - ${errorMessage}`,
      'Retry'
    ).then(selection => {
      if (selection === 'Retry') {
        detectFinOps();
      }
    });
  }
}

/**
 * Show blast radius command
 */
async function showBlastRadius() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }
  
  const symbolName = await getSymbolAtCursor(editor);
  if (!symbolName) {
    vscode.window.showWarningMessage('No symbol found at cursor');
    return;
  }
  
  // Check connectivity before making request
  const isConnected = await checkServerConnectivity();
  if (!isConnected) {
    vscode.window.showErrorMessage(
      'CodeCortex: Cannot connect to server. Please ensure the CodeCortex server is running.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'codecortex.serverUrl');
      }
    });
    return;
  }
  
  try {
    const response = await callCodeCortexServer('impact', {
      target: symbolName,
      direction: 'upstream',
      maxDepth: 3,
    });
    
    if (response) {
      showBlastRadiusWebview(response);
    }
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    vscode.window.showErrorMessage(
      `CodeCortex: Failed to show blast radius - ${errorMessage}`,
      'Retry'
    ).then(selection => {
      if (selection === 'Retry') {
        showBlastRadius();
      }
    });
  }
}

/**
 * Get symbol name at cursor position
 */
async function getSymbolAtCursor(editor: vscode.TextEditor): Promise<string | null> {
  const position = editor.selection.active;
  const wordRange = editor.document.getWordRangeAtPosition(position);
  
  if (wordRange) {
    return editor.document.getText(wordRange);
  }
  
  return null;
}

/**
 * Call CodeCortex server with graceful error handling
 * 
 * Handles network failures, server not running, and other common errors
 * with user-friendly messages.
 */
async function callCodeCortexServer(tool: string, params: any): Promise<any> {
  const serverUrl = vscode.workspace.getConfiguration('codecortex').get('serverUrl', 'http://localhost:4747');
  
  try {
    const response = await fetch(`${serverUrl}/api/tool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool,
        params,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }
    
    // Update connection status on success
    if (!serverConnected) {
      serverConnected = true;
      updateConnectionStatus(true);
    }
    lastConnectionCheck = Date.now();
    
    return response.json();
  } catch (error: any) {
    // Handle specific error types
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      serverConnected = false;
      updateConnectionStatus(false);
      throw new Error('Connection timeout: CodeCortex server is not responding. Please ensure the server is running.');
    }
    
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.message?.includes('network')) {
      serverConnected = false;
      updateConnectionStatus(false);
      throw new Error('Cannot connect to CodeCortex server. Please ensure the server is running at ' + serverUrl);
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected: boolean) {
  if (connected) {
    statusBarItem.text = '$(graph) CodeCortex';
    statusBarItem.tooltip = 'CodeCortex connected - Click to analyze blast radius';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(alert) CodeCortex: Disconnected';
    statusBarItem.tooltip = 'Cannot connect to CodeCortex server - Click to retry';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
}

/**
 * Check server connectivity
 */
async function checkServerConnectivity(): Promise<boolean> {
  const now = Date.now();
  if (now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL) {
    return serverConnected;
  }
  
  try {
    const serverUrl = vscode.workspace.getConfiguration('codecortex').get('serverUrl', 'http://localhost:4747');
    const response = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    serverConnected = response.ok;
  } catch {
    serverConnected = false;
  }
  
  lastConnectionCheck = Date.now();
  updateConnectionStatus(serverConnected);
  return serverConnected;
}

/**
 * Update status bar with risk level
 */
function updateStatusBar(risk: string, summary: string) {
  const emoji = getRiskEmoji(risk);
  statusBarItem.text = `${emoji} CodeCortex: ${risk.toUpperCase()}`;
  statusBarItem.tooltip = summary;
  statusBarItem.backgroundColor = getRiskColor(risk);
}

/**
 * Get risk emoji
 */
function getRiskEmoji(risk: string): string {
  switch (risk) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '🔶';
    case 'low': return '✅';
    default: return '🔍';
  }
}

/**
 * Get risk color
 */
function getRiskColor(risk: string): vscode.ThemeColor | undefined {
  switch (risk) {
    case 'critical':
      return new vscode.ThemeColor('statusBarItem.errorBackground');
    case 'high':
      return new vscode.ThemeColor('statusBarItem.warningBackground');
    default:
      return undefined;
  }
}

/**
 * Show impact webview
 */
function showImpactWebview(impact: any) {
  const panel = vscode.window.createWebviewPanel(
    'codecortexImpact',
    'CodeCortex Impact Analysis',
    vscode.ViewColumn.Beside,
    {}
  );
  
  panel.webview.html = getImpactWebviewContent(impact);
}

/**
 * Show guardrails webview
 */
function showGuardrailsWebview(result: any) {
  const panel = vscode.window.createWebviewPanel(
    'codecortexGuardrails',
    'CodeCortex Guardrails',
    vscode.ViewColumn.Beside,
    {}
  );
  
  panel.webview.html = getGuardrailsWebviewContent(result);
}

/**
 * Show blast radius webview
 */
function showBlastRadiusWebview(impact: any) {
  const panel = vscode.window.createWebviewPanel(
    'codecortexBlastRadius',
    'CodeCortex Blast Radius',
    vscode.ViewColumn.Beside,
    {}
  );
  
  panel.webview.html = getBlastRadiusWebviewContent(impact);
}

/**
 * Show FinOps webview
 */
function showFinOpsWebview(result: any) {
  const panel = vscode.window.createWebviewPanel(
    'codecortexFinOps',
    'CodeCortex FinOps Detection',
    vscode.ViewColumn.Beside,
    {}
  );
  
  panel.webview.html = getFinOpsWebviewContent(result);
}

/**
 * Get impact webview HTML
 */
function getImpactWebviewContent(impact: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .risk-critical { color: #ef4444; }
    .risk-high { color: #f59e0b; }
    .risk-medium { color: #3b82f6; }
    .risk-low { color: #10b981; }
    .stat { margin: 10px 0; }
    .symbol { background: #1a1a1a; padding: 10px; margin: 5px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Impact Analysis</h1>
  <div class="stat risk-${impact.risk}">Risk: ${impact.risk.toUpperCase()}</div>
  <div class="stat">Callers: ${impact.callers}</div>
  <div class="stat">Depth: ${impact.depth}</div>
  <h2>Affected Symbols</h2>
  ${impact.affectedSymbols?.map((s: any) => `
    <div class="symbol">
      <strong>${s.name}</strong> (${s.type})
      <div>Callers: ${s.callers}</div>
    </div>
  `).join('') || 'No affected symbols'}
</body>
</html>`;
}

/**
 * Get guardrails webview HTML
 */
function getGuardrailsWebviewContent(result: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .violation { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; }
    .suggestion { background: #f0fdf4; border-left: 4px solid #10b981; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Architectural Guardrails</h1>
  <h2>Violations (${result.violations?.length || 0})</h2>
  ${result.violations?.map((v: any) => `
    <div class="violation">
      <strong>${v.rule}</strong>
      <div>${v.description}</div>
      ${v.suggestion ? `<div><em>Suggestion: ${v.suggestion}</em></div>` : ''}
    </div>
  `).join('') || 'No violations'}
  <h2>Warnings (${result.warnings?.length || 0})</h2>
  ${result.warnings?.map((w: any) => `
    <div class="warning">
      <strong>${w.rule}</strong>
      <div>${w.description}</div>
    </div>
  `).join('') || 'No warnings'}
</body>
</html>`;
}

/**
 * Get blast radius webview HTML
 */
function getBlastRadiusWebviewContent(impact: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .node { background: #1a1a1a; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .node-critical { border-left: 4px solid #ef4444; }
    .node-high { border-left: 4px solid #f59e0b; }
    .node-medium { border-left: 4px solid #3b82f6; }
    .node-low { border-left: 4px solid #10b981; }
  </style>
</head>
<body>
  <h1>Blast Radius: ${impact.target}</h1>
  <div>Risk: ${impact.risk.toUpperCase()}</div>
  <div>Callers: ${impact.callers}</div>
  <h2>Affected Symbols</h2>
  ${impact.affectedSymbols?.map((s: any) => `
    <div class="node node-${s.risk}">
      <strong>${s.name}</strong> (${s.type})
      <div>Callers: ${s.callers} | Depth: ${s.depth}</div>
    </div>
  `).join('') || 'No affected symbols'}
</body>
</html>`;
}

/**
 * Get FinOps webview HTML
 */
function getFinOpsWebviewContent(result: any): string {
  const issues = result.issues || [];
  const summary = result.summary || { critical: 0, high: 0, medium: 0, low: 0 };
  
  // Group issues by category
  const issuesByCategory: Record<string, any[]> = {};
  issues.forEach((issue: any) => {
    const category = issue.category || 'other';
    if (!issuesByCategory[category]) {
      issuesByCategory[category] = [];
    }
    issuesByCategory[category].push(issue);
  });
  
  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'database': return '🗄️';
      case 'caching': return '⚡';
      case 'storage': return '💾';
      case 'network': return '🌐';
      case 'compute': return '🖥️';
      case 'api': return '🔌';
      default: return '💰';
    }
  };
  
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .summary { display: flex; gap: 20px; margin-bottom: 20px; }
    .summary-item { padding: 10px 15px; border-radius: 4px; }
    .summary-critical { background: #fef2f2; color: #ef4444; }
    .summary-high { background: #fffbeb; color: #f59e0b; }
    .summary-medium { background: #eff6ff; color: #3b82f6; }
    .summary-low { background: #f0fdf4; color: #10b981; }
    .category { margin-bottom: 20px; }
    .category-header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .issue { background: #1a1a1a; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid; }
    .issue-title { font-weight: bold; margin-bottom: 5px; }
    .issue-description { margin-bottom: 10px; }
    .issue-file { font-size: 12px; color: #9ca3af; margin-bottom: 5px; }
    .issue-suggestion { background: #f0fdf4; padding: 10px; border-radius: 4px; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>FinOps Detection</h1>
  <div class="summary">
    <div class="summary-item summary-critical">Critical: ${summary.critical}</div>
    <div class="summary-item summary-high">High: ${summary.high}</div>
    <div class="summary-item summary-medium">Medium: ${summary.medium}</div>
    <div class="summary-item summary-low">Low: ${summary.low}</div>
  </div>
  <div>Total Issues: ${issues.length}</div>
  ${Object.entries(issuesByCategory).map(([category, categoryIssues]) => `
    <div class="category">
      <div class="category-header">${getCategoryIcon(category)} ${category.charAt(0).toUpperCase() + category.slice(1)} (${categoryIssues.length})</div>
      ${categoryIssues.map((issue: any) => `
        <div class="issue" style="border-left-color: ${getSeverityColor(issue.severity)}">
          <div class="issue-title">${issue.title}</div>
          <div class="issue-description">${issue.description}</div>
          ${issue.file ? `<div class="issue-file">📁 ${issue.file}</div>` : ''}
          ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('') || '<p>No FinOps issues detected</p>'}
</body>
</html>`;
}

export function deactivate() {
  console.log('CodeCortex extension deactivated');
}
