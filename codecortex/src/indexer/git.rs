use crate::graph::CodeGraph;
use crate::core::{CodeNode, NodeKind, EdgeKind};
use std::process::Command;

pub struct GitIndexer;

impl GitIndexer {
    /// Ingests Git commit history to find co-modified files and add `CoModified` edges.
    pub fn ingest_git_history(graph: &mut CodeGraph, repo_path: &str, since_days: u32) -> anyhow::Result<()> {
        tracing::info!("Ingesting Git history from {} over the last {} days", repo_path, since_days);
        
        let since_arg = format!("--since={} days ago", since_days);
        
        // Run git log --name-only --format="COMMIT|%at" 
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(&["log", "--name-only", "--format=COMMIT|%at", &since_arg])
            .output()?;
            
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::error!("Git command failed: {}", stderr);
            return Err(anyhow::anyhow!("Failed to run git log: {}", stderr));
        }
        
        let log_output = String::from_utf8(output.stdout)?;
        
        // This will hold the strings of the files modified in the current commit
        let mut current_commit_files = Vec::new();
        
        for line in log_output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            
            if line.starts_with("COMMIT|") {
                // Process the previous commit's files before clearing
                Self::process_commit_files(graph, &current_commit_files);
                current_commit_files.clear();
            } else {
                // It's a file path
                current_commit_files.push(line.to_string());
            }
        }
        
        // Process the last commit
        Self::process_commit_files(graph, &current_commit_files);
        
        Ok(())
    }
    
    fn process_commit_files(graph: &mut CodeGraph, files: &[String]) {
        // Skip massive commits (likely auto-generated, mass renames, or massive refactors that pollute the graph)
        if files.len() < 2 || files.len() > 50 {
            return;
        }
        
        // For each pair of files, add a `CoModified` edge
        for i in 0..files.len() {
            for j in (i + 1)..files.len() {
                let file_a = &files[i];
                let file_b = &files[j];
                
                // Ensure nodes exist. We use the path as ID for file nodes.
                Self::ensure_file_node(graph, file_a);
                Self::ensure_file_node(graph, file_b);
                
                // Add weighted edges in both directions
                let _ = graph.add_weighted_edge(file_a, file_b, EdgeKind::CoModified, 1.0);
                let _ = graph.add_weighted_edge(file_b, file_a, EdgeKind::CoModified, 1.0);
            }
        }
    }
    
    fn ensure_file_node(graph: &mut CodeGraph, file_path: &str) {
        let node = CodeNode::new(
            file_path, // use file path as ID
            file_path, // use file path as name
            NodeKind::File,
            file_path,
            0,
            0,
        );
        graph.upsert_node(node);
    }
}
