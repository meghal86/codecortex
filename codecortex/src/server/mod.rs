use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

use crate::graph::CodeGraph;

/// Shared state available to all API routes
#[derive(Clone)]
pub struct AppState {
    pub graph: Arc<RwLock<CodeGraph>>,
}

/// Start the CodeCortex background HTTP server for Web UI clients
pub async fn run_server(graph: Arc<RwLock<CodeGraph>>, port: u16) -> anyhow::Result<()> {
    let state = AppState { graph };

    // CORS configuration for the frontend React/Next.js visualizer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/graph", get(get_graph))
        .route("/api/search", post(search_graph))
        .route("/api/health", get(health_check))
        .layer(cors)
        .with_state(state);

    let host = "127.0.0.1";
    let addr = format!("{}:{}", host, port);
    tracing::info!("Starting Axum HTTP REST API on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// ----------------------------------------------------------------------------
// Route Handlers
// ----------------------------------------------------------------------------

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub nodes: usize,
    pub edges: usize,
}

async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let graph = state.graph.read().await;
    let (nodes, edges) = graph.metrics();
    
    Json(HealthResponse {
        status: "ok".to_string(),
        nodes,
        edges,
    })
}

/// Dumps a simplified graph structure (up to a limit) for visualization
async fn get_graph(State(state): State<AppState>) -> Json<serde_json::Value> {
    let graph = state.graph.read().await;
    let (nodes, edges) = graph.metrics();
    
    // Stub definition - returning graph summary instead of full raw dump for now
    Json(serde_json::json!({
        "nodes": nodes,
        "edges": edges,
        "message": "Full JSON dump logic goes here."
    }))
}

#[derive(Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub limit: Option<usize>,
}

/// Mocks a hybrid semantic + BM25 search over the indexed graph nodes
async fn search_graph(
    State(_state): State<AppState>,
    Json(payload): Json<SearchRequest>,
) -> Json<serde_json::Value> {
    tracing::debug!("Searching for: {}", payload.query);
    
    // Stub definition - real integration with Qdrant and LLM embeddings goes here
    Json(serde_json::json!({
        "results": [
            {
                "id": "mock_result_1",
                "score": 0.98,
                "type": "Function"
            }
        ]
    }))
}
