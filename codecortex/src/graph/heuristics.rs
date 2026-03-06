use petgraph::graph::NodeIndex;
use std::collections::HashMap;
use crate::graph::CodeGraph;

/// Run a simplified Label Propagation Algorithm (LPA) to detect communities (Microservice boundaries)
pub fn detect_communities(graph_engine: &CodeGraph, max_iterations: usize) -> HashMap<String, usize> {
    let internal_graph = &graph_engine.inner;
    
    // Initialize: Every node is its own community
    let mut node_labels: HashMap<NodeIndex, usize> = HashMap::new();
    let mut id_to_label: HashMap<String, usize> = HashMap::new();
    
    for (i, idx) in internal_graph.node_indices().enumerate() {
        node_labels.insert(idx, i);
        if let Some(node_weight) = internal_graph.node_weight(idx) {
            id_to_label.insert(node_weight.id.clone(), i);
        }
    }
    
    if internal_graph.node_count() == 0 {
        return id_to_label;
    }

    // LPA loop
    let mut rng_seed = 42; // deterministic mock seed for MVP
    
    for _iteration in 0..max_iterations {
        let mut changed = false;
        
        let mut indices: Vec<NodeIndex> = internal_graph.node_indices().collect();
        // Simple pseudo-random shuffle to prevent oscillation
        indices.sort_by_key(|&idx| {
            rng_seed = rng_seed * 48271 % 2147483647;
            rng_seed ^ (idx.index() as u64)
        });
        
        for idx in indices {
            let mut label_counts: HashMap<usize, usize> = HashMap::new();
            
            // Look at neighbors
            for neighbor in internal_graph.neighbors_undirected(idx) {
                if let Some(&neighbor_label) = node_labels.get(&neighbor) {
                    *label_counts.entry(neighbor_label).or_insert(0) += 1;
                }
            }
            
            if label_counts.is_empty() {
                continue;
            }
            
            // Find most frequent label among neighbors
            let current_label = *node_labels.get(&idx).unwrap();
            let mut best_label = current_label;
            let mut max_count = 0;
            
            for (label, count) in label_counts {
                if count > max_count || (count == max_count && label < best_label) {
                    best_label = label;
                    max_count = count;
                }
            }
            
            if best_label != current_label {
                node_labels.insert(idx, best_label);
                changed = true;
            }
        }
        
        if !changed {
            break; // Converged
        }
    }
    
    // Map internal indices back to public Node IDs
    let mut final_communities: HashMap<String, usize> = HashMap::new();
    for (idx, label) in node_labels {
        if let Some(node_weight) = internal_graph.node_weight(idx) {
            final_communities.insert(node_weight.id.clone(), label);
        }
    }
    
    final_communities
}
