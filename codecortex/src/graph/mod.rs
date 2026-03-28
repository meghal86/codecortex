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
        
        let edge = CodeEdge::new(kind);

        self.inner.add_edge(source_idx, target_idx, edge);
        Ok(())
    }

    /// Number of nodes and edges
    pub fn metrics(&self) -> (usize, usize) {
        (self.inner.node_count(), self.inner.edge_count())
    }

    /// Appends a weighted edge, typically used for CoModified relationships
    pub fn add_weighted_edge(&mut self, source_id: &str, target_id: &str, kind: EdgeKind, weight: f32) -> anyhow::Result<()> {
        let source_idx = *self.id_map.get(source_id).ok_or_else(|| anyhow::anyhow!("Source node missing"))?;
        let target_idx = *self.id_map.get(target_id).ok_or_else(|| anyhow::anyhow!("Target node missing"))?;
        
        let mut edge = CodeEdge::new(kind);
        edge.weight = weight;

        // Find existing edge of same kind and merge weight if it exists
        if let Some(existing_edge_idx) = self.inner.find_edge(source_idx, target_idx) {
            let existing_edge = self.inner.edge_weight_mut(existing_edge_idx).unwrap();
            if existing_edge.kind == edge.kind {
                existing_edge.weight += weight;
                existing_edge.last_updated = edge.last_updated;
                return Ok(());
            }
        }
        
        self.inner.add_edge(source_idx, target_idx, edge);
        Ok(())
    }

    /// Applies temporal exponential decay to all edge weights.
    /// Prunes edges that fall below min_threshold.
    pub fn apply_temporal_decay(&mut self, half_life_days: f32, min_threshold: f32) {
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        
        let mut edges_to_remove = Vec::new();

        for e in self.inner.edge_indices() {
            if let Some(weight_ref) = self.inner.edge_weight_mut(e) {
                let seconds_elapsed = now.saturating_sub(weight_ref.last_updated) as f32;
                let days_elapsed = seconds_elapsed / 86400.0;
                
                // Exponential decay formula: N(t) = N0 * (0.5)^(t / t_half)
                let decay_factor = 0.5f32.powf(days_elapsed / half_life_days);
                weight_ref.weight *= decay_factor;
                weight_ref.last_updated = now;

                if weight_ref.weight < min_threshold {
                    edges_to_remove.push(e);
                }
            }
        }

        // Remove below threshold edges
        for e in edges_to_remove {
            self.inner.remove_edge(e);
        }
    }

    /// Runs the Label Propagation Algorithm (LPA) to tag components automatically
    pub fn compute_communities(&self) -> HashMap<String, usize> {
        heuristics::detect_communities(self, 100)
    }
}
