/**
 * FinOps Issue Detector
 * 
 * Detects financial operations (FinOps) issues in the codebase:
 * - Unoptimized cloud resource usage
 * - Missing cost tags/labels
 * - Inefficient database queries
 * - Unnecessary API calls
 * - Missing caching strategies
 * - Over-provisioned resources
 */

import { getBackend } from '../mcp/local/local-backend.js';
import { output } from '../lib/utils.js';

interface FinOpsOptions {
  repo?: string;
  severity?: 'all' | 'critical' | 'high' | 'medium' | 'low';
  json?: boolean;
}

/**
 * Detect FinOps issues command
 */
export async function finopsCommand(options?: FinOpsOptions): Promise<void> {
  const backend = await getBackend();
  const severity = options?.severity || 'all';
  
  const result = await backend.callTool('detect_finops', {
    repo: options?.repo,
    severity,
  });

  if (result.error) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  if (options?.json) {
    output(result);
    return;
  }

  // Format as Markdown
  let md = `## 💰 FinOps Analysis Report\n\n`;
  
  if (result.issues.length === 0) {
    md += `✅ **No FinOps issues detected**\n`;
    process.stdout.write(md + '\n');
    return;
  }

  const criticalCount = result.issues.filter((i: any) => i.severity === 'critical').length;
  const highCount = result.issues.filter((i: any) => i.severity === 'high').length;
  const mediumCount = result.issues.filter((i: any) => i.severity === 'medium').length;
  const lowCount = result.issues.filter((i: any) => i.severity === 'low').length;

  md += `### Summary\n\n`;
  md += `| Severity | Count |\n`;
  md += `|----------|-------|\n`;
  if (criticalCount > 0) md += `| 🚨 Critical | ${criticalCount} |\n`;
  if (highCount > 0) md += `| ⚠️ High | ${highCount} |\n`;
  if (mediumCount > 0) md += `| 🔶 Medium | ${mediumCount} |\n`;
  if (lowCount > 0) md += `| ✅ Low | ${lowCount} |\n`;
  md += `\n`;

  // Group by category
  const categories = [...new Set(result.issues.map((i: any) => i.category))];
  
  for (const category of categories) {
    const categoryIssues = result.issues.filter((i: any) => i.category === category);
    md += `### ${getCategoryEmoji(category)} ${category}\n\n`;
    
    for (const issue of categoryIssues) {
      const severityEmoji = getSeverityEmoji(issue.severity);
      md += `${severityEmoji} **${issue.title}**\n`;
      md += `   - ${issue.description}\n`;
      md += `   - 📍 File: \`${issue.file}\`\n`;
      if (issue.suggestion) {
        md += `   - 💡 Suggestion: ${issue.suggestion}\n`;
      }
      md += `\n`;
    }
  }

  // Print directly to stdout for bash piping
  process.stdout.write(md + '\n');
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '🔶';
    case 'low': return '✅';
    default: return '🔍';
  }
}

function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'cloud-resources': return '☁️';
    case 'database': return '🗄️';
    case 'api-calls': return '🔌';
    case 'caching': return '💾';
    case 'network': return '🌐';
    case 'storage': return '📦';
    default: return '💰';
  }
}
