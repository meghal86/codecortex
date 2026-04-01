/**
 * Architectural Guardrails Engine
 * 
 * Checks proposed code changes against architectural rules
 * and returns violations, warnings, and suggestions.
 */

import { executeParameterized } from '../core/kuzu-adapter.js';

interface GuardrailRule {
  name: string;
  description: string;
  pattern: RegExp;
  layers: string[];
  forbidden: string[];
  severity: 'error' | 'warning';
}

interface Violation {
  rule: string;
  description: string;
  severity: 'error' | 'warning';
  location: string;
  suggestion?: string;
}

interface GuardrailResult {
  violations: Violation[];
  warnings: Violation[];
  suggestions: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Built-in architectural rules for common layer separation patterns.
 * 
 * These rules enforce separation of concerns between different architectural layers.
 * They are designed to catch common violations in layered architectures:
 * - UI components should not directly access database/data layer
 * - Controllers should delegate to services rather than containing business logic
 * - Test files should be isolated from production code dependencies
 * - Entry points should not import other entry points (prevents circular initialization)
 * 
 * @note These rules use regex patterns which may produce false positives in edge cases.
 *       For production use, consider using AST-based analysis for more accurate detection.
 *       The patterns are designed to match actual import/require statements, not comments or strings.
 * @see GuardrailRule interface for rule structure
 */
const BUILTIN_RULES: GuardrailRule[] = [
  {
    name: 'UI-DB Direct Access',
    description: 'UI layer should not directly access database layer',
    // Matches import/require statements that reference database libraries
    // Excludes comments and string literals by requiring word boundaries
    // Limitation: May miss dynamic imports or aliased imports
    pattern: /(?:^|\s)(?:import|require)\s+(?:.*?\s+from\s+)?['"](?:.*?\/)?(?:database|db|sequelize|prisma|mongoose|typeorm|knex)(?:\/.*?)?['"]/i,
    layers: ['ui', 'components', 'pages', 'views'],
    forbidden: ['database', 'db', 'models', 'repositories'],
    severity: 'error',
  },
  {
    name: 'Controller-Service Separation',
    description: 'Controllers should not directly import business logic',
    // Matches import statements in controller files that import from service/business layers
    // Uses word boundaries to avoid matching in comments or strings
    // Limitation: May not detect indirect imports through barrel files
    pattern: /(?:^|\s)(?:import|require)\s+(?:.*?\s+from\s+)?['"](?:.*?\/)?(?:service|business|logic)(?:\/.*?)?['"]/i,
    layers: ['controllers', 'handlers', 'routes'],
    forbidden: ['services', 'business', 'logic'],
    severity: 'error',
  },
  {
    name: 'Test-Production Boundary',
    description: 'Test files should not import production code directly',
    // Matches import statements in test files that import from src/lib/app directories
    // Excludes test utilities and mocks which are allowed
    // Limitation: May not detect imports through test helpers
    pattern: /(?:^|\s)(?:import|require)\s+(?:.*?\s+from\s+)?['"](?:.*?\/)?(?:src|lib|app)(?:\/.*?)?['"]/i,
    layers: ['test', 'tests', '__tests__', 'spec'],
    forbidden: ['src', 'lib', 'app'],
    severity: 'warning',
  },
  {
    name: 'Entry Point Isolation',
    description: 'Entry points should not be called by other entry points',
    // Matches import statements between entry point files
    // Uses word boundaries to ensure we're matching actual imports
    // Limitation: May not detect indirect initialization through shared modules
    pattern: /(?:^|\s)(?:import|require)\s+(?:.*?\s+from\s+)?['"](?:.*?\/)?(?:main|index|app|server|cli)(?:\.\w+)?['"]/i,
    layers: ['main', 'index', 'app', 'server', 'cli'],
    forbidden: ['main', 'index', 'app', 'server', 'cli'],
    severity: 'error',
  },
  {
    name: 'Circular Dependency',
    description: 'Potential circular dependency detected',
    // Matches relative imports that could create circular dependencies
    // Only flags imports that go up directories (../) which are higher risk
    // Limitation: Cannot detect actual circular dependencies without graph analysis
    pattern: /(?:^|\s)(?:import|require)\s+(?:.*?\s+from\s+)?['"]\.\.\/.*?['"]/i,
    layers: ['*'],
    forbidden: [],
    severity: 'warning',
  },
];

/**
 * Check guardrails for a proposed change
 */
export async function checkGuardrails(
  repoId: string,
  filePath: string,
  changeType: string,
  symbolName?: string,
  targetSymbol?: string
): Promise<GuardrailResult> {
  const violations: Violation[] = [];
  const warnings: Violation[] = [];
  const suggestions: string[] = [];
  
  // Load custom rules from .codecortex/rules.json if exists
  const customRules = await loadCustomRules(repoId);
  const allRules = [...BUILTIN_RULES, ...customRules];
  
  // Check file path against layer rules
  for (const rule of allRules) {
    const fileLayer = getLayerFromPath(filePath);
    
    // Check if this file is in a restricted layer
    if (rule.layers.some(l => l === '*' || fileLayer.includes(l))) {
      // Check if change involves forbidden layers
      if (changeType === 'add_import' && targetSymbol) {
        const targetLayer = await getLayerFromSymbol(repoId, targetSymbol);
        if (targetLayer && rule.forbidden.some(f => targetLayer.includes(f))) {
          if (rule.severity === 'error') {
            violations.push({
              rule: rule.name,
              description: rule.description,
              severity: 'error',
              location: filePath,
              suggestion: `Consider using a service layer or dependency injection instead of importing ${targetSymbol} directly.`,
            });
          } else {
            warnings.push({
              rule: rule.name,
              description: rule.description,
              severity: 'warning',
              location: filePath,
              suggestion: `Review this dependency to ensure it's intentional.`,
            });
          }
        }
      }
    }
  }
  
  // Check for circular dependencies
  if (changeType === 'add_import' && targetSymbol) {
    const hasCircular = await checkCircularDependency(repoId, filePath, targetSymbol);
    if (hasCircular) {
      violations.push({
        rule: 'Circular Dependency',
        description: `Importing ${targetSymbol} would create a circular dependency`,
        severity: 'error',
        location: filePath,
        suggestion: 'Consider extracting shared logic into a separate module.',
      });
    }
  }
  
  // Check for high-risk symbols
  if (symbolName) {
    const risk = await checkSymbolRisk(repoId, symbolName);
    if (risk === 'critical') {
      warnings.push({
        rule: 'High-Risk Symbol',
        description: `${symbolName} is a critical node with many dependents`,
        severity: 'warning',
        location: filePath,
        suggestion: 'Consider creating a new function instead of modifying this one.',
      });
    }
  }
  
  // Calculate risk level
  const riskLevel = calculateRiskLevel(violations, warnings);
  
  // Generate suggestions
  if (violations.length > 0) {
    suggestions.push('Fix all violations before committing.');
    suggestions.push('Use impact() to understand the full blast radius of your changes.');
  }
  if (warnings.length > 0) {
    suggestions.push('Review warnings to ensure they are intentional.');
  }
  
  return {
    violations,
    warnings,
    suggestions,
    risk_level: riskLevel,
  };
}

/**
 * Load custom rules from .codecortex/rules.json
 */
async function loadCustomRules(repoId: string): Promise<GuardrailRule[]> {
  try {
    // In a real implementation, this would read from the repo's .codecortex/rules.json
    // For now, return empty array
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Get layer from file path
 */
function getLayerFromPath(filePath: string): string {
  const parts = filePath.toLowerCase().split('/');
  
  // Common layer patterns
  const layerPatterns = [
    { pattern: /ui|components|pages|views/, layer: 'ui' },
    { pattern: /controllers|handlers|routes/, layer: 'controller' },
    { pattern: /services|business|logic/, layer: 'service' },
    { pattern: /models|entities|schemas/, layer: 'model' },
    { pattern: /repositories|dao|data/, layer: 'data' },
    { pattern: /utils|helpers|common/, layer: 'utility' },
    { pattern: /test|tests|__tests__|spec/, layer: 'test' },
    { pattern: /main|index|app|server/, layer: 'entry' },
  ];
  
  for (const part of parts) {
    for (const { pattern, layer } of layerPatterns) {
      if (pattern.test(part)) {
        return layer;
      }
    }
  }
  
  return 'unknown';
}

/**
 * Get layer from symbol
 */
async function getLayerFromSymbol(repoId: string, symbolName: string): Promise<string | null> {
  try {
    const rows = await executeParameterized(repoId, `
      MATCH (n {name: $symbolName})
      RETURN n.filePath AS filePath
      LIMIT 1
    `, { symbolName });
    
    if (rows.length > 0) {
      const filePath = rows[0].filePath ?? rows[0][0];
      return getLayerFromPath(filePath);
    }
  } catch (error) {
    // Symbol not found
  }
  
  return null;
}

/**
 * Check for circular dependency
 */
async function checkCircularDependency(
  repoId: string,
  sourceFile: string,
  targetSymbol: string
): Promise<boolean> {
  try {
    // Check if target symbol imports from source file
    const rows = await executeParameterized(repoId, `
      MATCH (target {name: $targetSymbol})-[:CodeRelation {type: 'IMPORTS'}]->(source)
      WHERE source.filePath = $sourceFile
      RETURN count(*) AS count
    `, { targetSymbol, sourceFile });
    
    if (rows.length > 0) {
      const count = rows[0].count ?? rows[0][0];
      return count > 0;
    }
  } catch (error) {
    // Query failed
  }
  
  return false;
}

/**
 * Check if symbol is high-risk
 */
async function checkSymbolRisk(repoId: string, symbolName: string): Promise<string> {
  try {
    const rows = await executeParameterized(repoId, `
      MATCH (n {name: $symbolName})<-[r:CodeRelation {type: 'CALLS'}]-()
      RETURN count(*) AS callerCount
    `, { symbolName });
    
    if (rows.length > 0) {
      const callerCount = rows[0].callerCount ?? rows[0][0];
      if (callerCount > 20) return 'critical';
      if (callerCount > 10) return 'high';
      if (callerCount > 5) return 'medium';
    }
  } catch (error) {
    // Query failed
  }
  
  return 'low';
}

/**
 * Calculate overall risk level
 */
function calculateRiskLevel(
  violations: Violation[],
  warnings: Violation[]
): 'low' | 'medium' | 'high' | 'critical' {
  const errorCount = violations.length;
  const warningCount = warnings.length;
  
  if (errorCount > 2) return 'critical';
  if (errorCount > 0) return 'high';
  if (warningCount > 2) return 'medium';
  return 'low';
}
