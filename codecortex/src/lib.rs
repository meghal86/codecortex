pub mod core;
pub mod graph;

#[cfg(not(target_arch = "wasm32"))]
pub mod indexer;

#[cfg(not(target_arch = "wasm32"))]
pub mod mcp;

#[cfg(not(target_arch = "wasm32"))]
pub mod server;

#[cfg(not(target_arch = "wasm32"))]
pub mod agent;

use wasm_bindgen::prelude::*;
use std::sync::RwLock;

use crate::graph::CodeGraph;

// Singleton Graph instance for the browser memory context
static mut BROWSER_GRAPH: Option<RwLock<CodeGraph>> = None;

#[wasm_bindgen]
pub fn init_graph() {
    unsafe {
        BROWSER_GRAPH = Some(RwLock::new(CodeGraph::new()));
    }
}

#[wasm_bindgen]
pub fn get_metrics() -> JsValue {
    unsafe {
        if let Some(graph_lock) = &BROWSER_GRAPH {
            if let Ok(graph) = graph_lock.read() {
                let (nodes, edges) = graph.metrics();
                return serde_wasm_bindgen::to_value(&serde_json::json!({
                    "nodes": nodes,
                    "edges": edges,
                })).unwrap();
            }
        }
    }
    JsValue::NULL
}

#[wasm_bindgen]
pub fn detect_communities() -> JsValue {
    unsafe {
        if let Some(graph_lock) = &BROWSER_GRAPH {
            if let Ok(graph) = graph_lock.read() {
                let communities = graph.compute_communities();
                return serde_wasm_bindgen::to_value(&communities).unwrap();
            }
        }
    }
    JsValue::NULL
}
