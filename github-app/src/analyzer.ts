/**
 * PR Impact Analyzer
 * 
 * Analyzes a GitHub PR and calculates the architectural blast radius
 * using the CodeCortex knowledge graph.
 */

import { Octokit } from '@octokit/rest';

import { PRFile, AnalysisInput, SymbolImpact, ArchitecturalViolation, ProcessImpact, AnalysisResult } from "./types.js";

// CodeCortex service configuration
const CODECORTEX_SERVICE_URL = process.env.CODECORTEX_SERVICE_URL || 'http://localhost:4747';


/**
 * Analyze a PR and calculate architectural impact
 */
export async function analyzePR(input: AnalysisInput): Promise<AnalysisResult> {
  const { owner, repo, prNumber, files, octokit } = input;
  
  // Step 1: Extract changed symbols from the diff
  const changedSymbols = await extractChangedSymbols(files, octokit, owner, repo);
  
  // Step 2: For each changed symbol, calculate blast radius
  const symbolImpacts: SymbolImpact[] = [];
  for (const symbol of changedSymbols) {
    const impact = await calculateBlastRadius(symbol, octokit, owner, repo);
    symbolImpacts.push(impact);
  }
  
  // Step 3: Detect architectural violations
  const violations = await detectViolations(files, octokit, owner, repo);
  
  // Step 4: Find affected processes
  const affectedProcesses = await findAffectedProcesses(symbolImpacts, octokit, owner, repo);
  
  // Step 5: Calculate overall risk level
  const riskLevel = calculateRiskLevel(symbolImpacts, violations, affectedProcesses);
  
  // Step 6: Generate summary
  const summary = generateSummary(symbolImpacts, violations, affectedProcesses, riskLevel);
  
  return {
    prNumber,
    changedFiles: files.length,
    changedSymbols: symbolImpacts,
    affectedProcesses,
    violations,
    riskLevel,
    summary,
  };
}

/**
 * Extract changed symbols from the PR diff
 */
async function extractChangedSymbols(
  files: PRFile[],
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Array<{ name: string; type: string; filePath: string }>> {
  const symbols: Array<{ name: string; type: string; filePath: string }> = [];
  
  for (const file of files) {
    if (!file.patch) continue;
    
    // Parse the patch to find changed functions/classes
    const lines = file.patch.split('\n');
    let currentFunction: string | null = null;
    let currentClass: string | null = null;
    
    for (const line of lines) {
      // Detect function definitions
      const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*[=(]/);
      if (funcMatch) {
        currentFunction = funcMatch[1];
        symbols.push({
          name: currentFunction,
          type: 'Function',
          filePath: file.filename,
        });
      }
      
      // Detect class definitions
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        currentClass = classMatch[1];
        symbols.push({
          name: currentClass,
          type: 'Class',
          filePath: file.filename,
        });
      }
      
      // Detect method definitions
      const methodMatch = line.match(/(?:async\s+)?(\w+)\s*\(/);
      if (methodMatch && currentClass) {
        symbols.push({
          name: `${currentClass}.${methodMatch[1]}`,
          type: 'Method',
          filePath: file.filename,
        });
      }
    }
  }
  
  return symbols;
}

/**
 * Calculate blast radius for a symbol using CodeCortex knowledge graph
 */
async function calculateBlastRadius(
  symbol: { name: string; type: string; filePath: string },
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<SymbolImpact> {
  try {
    // Query CodeCortex knowledge graph for impact analysis
    const response = await fetch(`${CODECORTEX_SERVICE_URL}/api/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'impact',
        params: {
          target: symbol.name,
          direction: 'upstream',
          maxDepth: 3,
          repo: `${owner}/${repo}`,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`CodeCortex API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Extract blast radius data from the impact analysis
    const callers = result.summary?.directCallers || 0;
    const depth = result.byDepth ? Math.min(3, Object.keys(result.byDepth).length) : 1;
    const risk = result.risk?.toLowerCase() || 'low';

    return {
      ...symbol,
      callers,
      depth,
      risk: risk as 'low' | 'medium' | 'high' | 'critical',
    };
  } catch (error) {
    console.error(`Error calculating blast radius for ${symbol.name}:`, error);
    // Return safe defaults if service is unavailable
    return {
      ...symbol,
      callers: 0,
      depth: 1,
      risk: 'low',
    };
  }
}

/**
 * Detect architectural violations using CodeCortex knowledge graph
 */
async function detectViolations(
  files: PRFile[],
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<ArchitecturalViolation[]> {
  const violations: ArchitecturalViolation[] = [];
  
  // Check each file for architectural violations using the knowledge graph
  for (const file of files) {
    if (!file.patch) continue;
    
    try {
      // Query CodeCortex knowledge graph for guardrail checks
      const response = await fetch(`${CODECORTEX_SERVICE_URL}/api/tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'check_guardrails',
          params: {
            file_path: file.filename,
            change_type: 'modify_function',
            repo: `${owner}/${repo}`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`CodeCortex API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Extract violations from the guardrail check result
      if (result.violations && Array.isArray(result.violations)) {
        for (const violation of result.violations) {
          violations.push({
            rule: violation.rule || 'Architectural Violation',
            description: violation.description || 'Violation detected by knowledge graph',
            locations: [file.filename],
          });
        }
      }
    } catch (error) {
      console.error(`Error checking guardrails for ${file.filename}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return violations;
}

/**
 * Find affected processes using CodeCortex knowledge graph
 */
async function findAffectedProcesses(
  symbolImpacts: SymbolImpact[],
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<ProcessImpact[]> {
  const processes: ProcessImpact[] = [];
  
  // Query the knowledge graph for each high-risk symbol to find affected processes
  for (const symbol of symbolImpacts) {
    if (symbol.risk === 'high' || symbol.risk === 'critical') {
      try {
        // Query CodeCortex knowledge graph for impact analysis
        const response = await fetch(`${CODECORTEX_SERVICE_URL}/api/tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'impact',
            params: {
              target: symbol.name,
              direction: 'upstream',
              maxDepth: 3,
              repo: `${owner}/${repo}`,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`CodeCortex API error: ${response.status}`);
        }

        const result = await response.json();
        
        // Extract affected processes from the impact analysis
        if (result.affectedProcesses && Array.isArray(result.affectedProcesses)) {
          for (const process of result.affectedProcesses) {
            processes.push({
              name: process.name || `${symbol.name} Flow`,
              type: process.type || 'Execution Flow',
              stepCount: process.stepCount || 0,
              affectedSteps: process.affectedSteps || 0,
            });
          }
        }
      } catch (error) {
        console.error(`Error finding affected processes for ${symbol.name}:`, error);
        // Continue with other symbols even if one fails
      }
    }
  }
  
  return processes;
}

/**
 * Calculate overall risk level
 */
function calculateRiskLevel(
  symbolImpacts: SymbolImpact[],
  violations: ArchitecturalViolation[],
  affectedProcesses: ProcessImpact[]
): 'low' | 'medium' | 'high' | 'critical' {
  const criticalSymbols = symbolImpacts.filter(s => s.risk === 'critical').length;
  const highSymbols = symbolImpacts.filter(s => s.risk === 'high').length;
  const violationCount = violations.length;
  const processCount = affectedProcesses.length;
  
  if (criticalSymbols > 0 || violationCount > 2) return 'critical';
  if (highSymbols > 0 || violationCount > 0 || processCount > 2) return 'high';
  if (symbolImpacts.length > 5) return 'medium';
  return 'low';
}

/**
 * Generate analysis summary
 */
function generateSummary(
  symbolImpacts: SymbolImpact[],
  violations: ArchitecturalViolation[],
  affectedProcesses: ProcessImpact[],
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
): string {
  const parts: string[] = [];
  
  if (symbolImpacts.length > 0) {
    const critical = symbolImpacts.filter(s => s.risk === 'critical');
    const high = symbolImpacts.filter(s => s.risk === 'high');
    
    if (critical.length > 0) {
      parts.push(`🚨 **${critical.length} critical symbol(s)** modified — these are highly connected nodes`);
    }
    if (high.length > 0) {
      parts.push(`⚠️ **${high.length} high-risk symbol(s)** modified — significant downstream impact`);
    }
  }
  
  if (violations.length > 0) {
    parts.push(`🏗️ **${violations.length} architectural violation(s)** detected`);
  }
  
  if (affectedProcesses.length > 0) {
    parts.push(`🔄 **${affectedProcesses.length} execution flow(s)** affected`);
  }
  
  if (parts.length === 0) {
    parts.push('✅ No significant architectural impact detected');
  }
  
  return parts.join('\n');
}
