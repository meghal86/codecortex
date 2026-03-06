use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// The types of code nodes we can identify
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NodeKind {
    File,
    Function,
    Class,
    Method,
    Interface,
    Variable,
    Package,
}

/// A node in the CodeCortex semantic graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeNode {
    pub id: String,
    pub name: String,
    pub kind: NodeKind,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    /// Semantic snippet/summary
    pub context: Option<String>,
}

/// The types of relationships between nodes
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EdgeKind {
    Calls,
    Imports,
    Defines,
    Inherits,
    Implements,
}

/// An edge representing a relationship in the codebase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEdge {
    pub kind: EdgeKind,
    /// Metadata like confidence (compiler vs heuristic)
    pub metadata: HashMap<String, String>,
}

impl CodeNode {
    pub fn new(id: &str, name: &str, kind: NodeKind, file_path: &str, start: usize, end: usize) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            kind,
            file_path: file_path.to_string(),
            start_line: start,
            end_line: end,
            context: None,
        }
    }
}
