pub mod core;
pub mod graph;
pub mod indexer;
pub mod mcp;
pub mod server;
pub mod agent;

use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    tracing::info!("CodeCortex initializing...");

    let mut graph = graph::CodeGraph::new();
    indexer::Indexer::ingest_scip(&mut graph, "dummy.scip")?;

    tracing::info!("Ingesting Git-Commit Coupling history...");
    if let Err(e) = indexer::git::GitIndexer::ingest_git_history(&mut graph, ".", 90) {
        tracing::warn!("Failed to ingest Git history: {}", e);
    }

    tracing::info!("Applying temporal decay to graph edges...");
    graph.apply_temporal_decay(30.0, 0.01);

    // Initialize Meta-Retrieval Cache
    let cache = core::meta::SemanticCache::new();

    tracing::info!("Seeding AI Personas...");
    agent::skills::seed_workspace(std::path::Path::new(".")).await?;

    let shared_graph = Arc::new(RwLock::new(graph));
    let shared_cache = Arc::new(RwLock::new(cache));

    // Spawn the background API server (for Web UIs)
    let api_graph = shared_graph.clone();
    let api_cache = shared_cache.clone();
    tokio::spawn(async move {
        if let Err(e) = server::run_server(api_graph, api_cache, 3030).await {
            tracing::error!("HTTP Server crashed: {}", e);
        }
    });

    tracing::info!("Starting stdio MCP server loop...");
    mcp::run_stdio(shared_graph, shared_cache).await?;

    Ok(())
}



