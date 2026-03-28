use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A cached association between a Natural Language query and a specific Code Node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedNode {
    pub node_id: String,
    /// Score accumulated by developer feedback. High score = very useful for this query.
    pub utility_score: f32,
    /// Unix timestamp of last feedback
    pub last_updated: u64,
}

/// The Semantic Cache Layer for the CodeCortex Meta-Graph.
/// Maps user string queries (intents) to lists of highly relevant Nodes.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SemanticCache {
    /// Mapping of normalized query strings to a list of node associations
    pub query_to_nodes: HashMap<String, Vec<CachedNode>>,
}

impl SemanticCache {
    pub fn new() -> Self {
        Self {
            query_to_nodes: HashMap::new(),
        }
    }

    /// Normalizes a query for caching by converting to lowercase and trimming
    fn normalize_query(query: &str) -> String {
        query.trim().to_lowercase()
    }

    /// Retrieves highly weighted nodes for a given query, sorted by utility score descending
    pub fn get_fast_path(&self, query: &str) -> Option<Vec<CachedNode>> {
        let normalized = Self::normalize_query(query);
        if let Some(nodes) = self.query_to_nodes.get(&normalized) {
            let mut sorted = nodes.clone();
            // Sort by utility score descending
            sorted.sort_by(|a, b| b.utility_score.partial_cmp(&a.utility_score).unwrap_or(std::cmp::Ordering::Equal));
            Some(sorted)
        } else {
            None
        }
    }

    /// Records developer feedback (Tribal Knowledge).
    /// Positive utility (> 0.0) strengthens the bond, negative (< 0.0) weakens it.
    pub fn record_feedback(&mut self, query: &str, node_id: &str, utility: f32) {
        let normalized = Self::normalize_query(query);
        let nodes = self.query_to_nodes.entry(normalized).or_insert_with(Vec::new);

        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();

        // Check if node already exists for this query
        if let Some(cached) = nodes.iter_mut().find(|n| n.node_id == node_id) {
            cached.utility_score += utility;
            cached.last_updated = now;
        } else {
            // New association
            nodes.push(CachedNode {
                node_id: node_id.to_string(),
                utility_score: utility,
                last_updated: now,
            });
        }
        
        // Optional Phase 3: We could add logic here to automatically prune nodes 
        // that drop below a negative utility threshold (e.g., < -5.0) to remove noise.
    }

    /// Identifies queries (intents) that repeatedly fail to yield useful code nodes.
    /// A "Knowledge Desert" is a query where the sum of all node utilities is highly negative.
    pub fn identify_knowledge_deserts(&self, threshold: f32) -> Vec<(String, f32)> {
        let mut deserts = Vec::new();

        for (query, nodes) in &self.query_to_nodes {
            let total_utility: f32 = nodes.iter().map(|n| n.utility_score).sum();
            
            // If the total utility is less than our negative threshold, it's a desert
            if total_utility <= threshold {
                deserts.push((query.clone(), total_utility));
            }
        }

        // Sort by worst utility first (most negative)
        deserts.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        deserts
    }
}
