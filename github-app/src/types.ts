/**
 * Shared type definitions for CodeCortex GitHub App
 */

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface AnalysisInput {
  owner: string;
  repo: string;
  prNumber: number;
  files: PRFile[];
  octokit: any; // Octokit type from @octokit/rest
}

export interface SymbolImpact {
  name: string;
  type: string;
  filePath: string;
  callers: number;
  depth: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface ArchitecturalViolation {
  rule: string;
  description: string;
  locations: string[];
}

export interface ProcessImpact {
  name: string;
  type: string;
  stepCount: number;
  affectedSteps: number;
}

export interface AnalysisResult {
  prNumber: number;
  changedFiles: number;
  changedSymbols: SymbolImpact[];
  affectedProcesses: ProcessImpact[];
  violations: ArchitecturalViolation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}
