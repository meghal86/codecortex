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
use crate::core::meta::SemanticCache;

/// Shared state available to all API routes
#[derive(Clone)]
pub struct AppState {
    pub graph: Arc<RwLock<CodeGraph>>,
    pub cache: Arc<RwLock<SemanticCache>>,
}

/// Start the CodeCortex background HTTP server for Web UI clients
pub async fn run_server(graph: Arc<RwLock<CodeGraph>>, cache: Arc<RwLock<SemanticCache>>, port: u16) -> anyhow::Result<()> {
    let state = AppState { graph, cache };

    // CORS configuration for the frontend React/Next.js visualizer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/graph", get(get_graph))
        .route("/api/search", post(search_graph))
        .route("/api/health", get(health_check))
        .route("/api/feedback", post(log_feedback))
        .route("/api/analytics/subsystems", get(get_subsystems))
        .route("/api/analytics/deserts", get(get_knowledge_deserts_api))
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
    State(state): State<AppState>,
    Json(payload): Json<SearchRequest>,
) -> Json<serde_json::Value> {
    tracing::debug!("Searching for: {}", payload.query);
    
    // Check Fast Path
    let cache = state.cache.read().await;
    if let Some(fast_nodes) = cache.get_fast_path(&payload.query) {
        if !fast_nodes.is_empty() {
            // Found a cached Tribal Knowledge path!
            tracing::info!("Cache HIT for query '{}'", payload.query);
            return Json(serde_json::json!({
                "results": fast_nodes,
                "source": "Meta-Retrieval Cache"
            }));
        }
    }
    
    tracing::info!("Cache MISS for query '{}'. Falling back to graph search.", payload.query);
    // Stub definition - real integration with Qdrant and LLM embeddings goes here
    Json(serde_json::json!({
        "results": [
            {
                "id": "mock_result_1",
                "score": 0.98,
                "type": "Function"
            }
        ],
        "source": "Graph Search"
    }))
}

#[derive(Deserialize)]
pub struct FeedbackRequest {
    pub query: String,
    pub node_id: String,
    pub utility_score: f32,
}

async fn log_feedback(
    State(state): State<AppState>,
    Json(payload): Json<FeedbackRequest>,
) -> Json<serde_json::Value> {
    let mut cache = state.cache.write().await;
    cache.record_feedback(&payload.query, &payload.node_id, payload.utility_score);
    tracing::info!("Recorded feedback for query '{}' -> node ID '{}' with score {}", payload.query, payload.node_id, payload.utility_score);
    Json(serde_json::json!({ "status": "Feedback logged successfully" }))
}

async fn get_subsystems(State(state): State<AppState>) -> Json<serde_json::Value> {
    let graph = state.graph.read().await;
    // Get architectural clusters via Label Propagation Algorithm
    let communities = graph.compute_communities();
    
    Json(serde_json::json!({
        "status": "success",
        "description": "Subsystems dynamically identified via LPA community detection",
        "subsystems": communities
    }))
}

async fn get_knowledge_deserts_api(State(state): State<AppState>) -> Json<serde_json::Value> {
    let cache = state.cache.read().await;
    // Any query with a utility score sum <= 0.0 is considered a desert (needs docs or refactor)
    let deserts = cache.identify_knowledge_deserts(0.0);
    
    let formatted: Vec<_> = deserts.into_iter().map(|(query, score)| {
        serde_json::json!({
            "intent": query,
            "utility_score": score,
            "status": "Needs Documentation or Refactoring"
        })
    }).collect();

    Json(serde_json::json!({
        "status": "success",
        "knowledge_deserts": formatted
    }))
}
