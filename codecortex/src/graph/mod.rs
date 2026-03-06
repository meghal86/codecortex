pub mod heuristics;

use crate::core::{CodeEdge, CodeNode, EdgeKind};
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

/// The in-memory graph engine managing the knowledge base
pub struct CodeGraph {
    /// The underlying Directed Graph
    inner: DiGraph<CodeNode, CodeEdge>,
    /// Fast lookup from a String ID (e.g., fully qualified symbol name) to the NodeIndex
    id_map: HashMap<String, NodeIndex>,
}

impl CodeGraph {
    pub fn new() -> Self {
        Self {
            inner: DiGraph::new(),
            id_map: HashMap::new(),
        }
    }

    /// Adds a node to the graph, or updates it if the ID already exists
    pub fn upsert_node(&mut self, node: CodeNode) -> NodeIndex {
        if let Some(&idx) = self.id_map.get(&node.id) {
            *self.inner.node_weight_mut(idx).unwrap() = node;
            idx
        } else {
            let id = node.id.clone();
            let idx = self.inner.add_node(node);
            self.id_map.insert(id, idx);
            idx
        }
    }

    /// Adds a semantic relationship between two nodes
    pub fn add_edge(&mut self, source_id: &str, target_id: &str, kind: EdgeKind) -> anyhow::Result<()> {
        let source_idx = *self.id_map.get(source_id).ok_or_else(|| anyhow::anyhow!("Source node missing"))?;
        let target_idx = *self.id_map.get(target_id).ok_or_else(|| anyhow::anyhow!("Target node missing"))?;
        
        let edge = CodeEdge {
            kind,
            metadata: HashMap::new(),
        };

        self.inner.add_edge(source_idx, target_idx, edge);
        Ok(())
    }

    /// Number of nodes and edges
    pub fn metrics(&self) -> (usize, usize) {
        (self.inner.node_count(), self.inner.edge_count())
    }

    /// Runs the Label Propagation Algorithm (LPA) to tag components automatically
    pub fn compute_communities(&self) -> HashMap<String, usize> {
        heuristics::detect_communities(self, 100)
    }
}
