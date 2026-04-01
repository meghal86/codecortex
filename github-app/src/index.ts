/**
 * CodeCortex GitHub App
 * 
 * Zero-configuration GitHub App that automatically analyzes PRs
 * and posts architectural impact comments.
 * 
 * The "never seen this before" moment:
 * Developer opens a PR → sees a comment saying:
 * "This change touches AuthService which is the most connected node
 * in your system — 31 functions across 6 modules depend on it.
 * Your architectural rule 'UI layer should not call DB layer directly'
 * has been violated in 2 places. Estimated risk: High."
 */

import { Probot } from 'probot';
import { analyzePR } from './analyzer.js';
import { formatImpactComment } from './formatter.js';

export default function app(app: Probot) {
  // Listen for pull request events
  app.on(['pull_request.opened', 'pull_request.synchronize'], async (context) => {
    const { pull_request: pr } = context.payload;
    const owner = context.repo().owner;
    const repo = context.repo().repo;
    
    console.log(`[CodeCortex] Analyzing PR #${pr.number} in ${owner}/${repo}`);
    
    try {
      // Get the diff between base and head
      const { data: files } = await context.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
      });
      
      // Analyze the PR impact
      const analysis = await analyzePR({
        owner,
        repo,
        prNumber: pr.number,
        files: files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        })),
        octokit: context.octokit,
      });
      
      // Format the comment
      const comment = formatImpactComment(analysis);
      
      // Find existing bot comment to update (avoid spam)
      const { data: comments } = await context.octokit.issues.listComments({
        owner,
        repo,
        issue_number: pr.number,
      });
      
      const botComment = comments.find(c => 
        c.user?.login === 'codecortex[bot]' || 
        c.body?.includes('CodeCortex Impact Analysis')
      );
      
      if (botComment) {
        await context.octokit.issues.updateComment({
          owner,
          repo,
          comment_id: botComment.id,
          body: comment,
        });
        console.log(`[CodeCortex] Updated comment on PR #${pr.number}`);
      } else {
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: pr.number,
          body: comment,
        });
        console.log(`[CodeCortex] Created comment on PR #${pr.number}`);
      }
      
    } catch (error) {
      console.error(`[CodeCortex] Error analyzing PR #${pr.number}:`, error);
      
      // Post error comment so user knows something went wrong
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: `## ⚠️ CodeCortex Analysis Error\n\nFailed to analyze this PR. Please check the app logs.\n\nError: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });
  
  // Also listen for push events to main/master to update the index
  app.on('push', async (context) => {
    const { ref, repository } = context.payload;
    
    // Only analyze pushes to main branches
    if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
      console.log(`[CodeCortex] Push to ${ref} in ${repository.full_name} — scheduling re-index`);
      
      try {
        // Trigger re-index via CodeCortex service
        const codecortexServiceUrl = process.env.CODECORTEX_SERVICE_URL || 'http://localhost:4747';
        const response = await fetch(`${codecortexServiceUrl}/api/reindex`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: repository.full_name,
            ref: ref,
            clone_url: repository.clone_url,
          }),
        });
        
        if (response.ok) {
          console.log(`[CodeCortex] Re-index triggered successfully for ${repository.full_name}`);
        } else {
          console.error(`[CodeCortex] Failed to trigger re-index: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error(`[CodeCortex] Error triggering re-index:`, error);
      }
    }
  });
}
