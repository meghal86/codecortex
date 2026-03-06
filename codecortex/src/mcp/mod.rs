use async_trait::async_trait;
use mcp_sdk_rs::{
    error::{Error, ErrorCode},
    server::{Server, ServerHandler},
    transport::{Transport, Message},
    types::{ClientCapabilities, Implementation, ServerCapabilities},
};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::graph::CodeGraph;

/// The CodeCortex Model Context Protocol (MCP) server
pub struct CodeCortexMcp {
    pub graph: Arc<RwLock<CodeGraph>>,
}

impl CodeCortexMcp {
    pub fn new(graph: Arc<RwLock<CodeGraph>>) -> Self {
        Self { graph }
    }

    /// Handles MCP Tool Execution
    async fn call_tool(&self, name: &str, params: Option<serde_json::Value>) -> Result<serde_json::Value, Error> {
        let args = params.and_then(|p| p.get("arguments").cloned()).unwrap_or(json!({}));
        
        match name {
            "get_impact" => {
                let target_symbol = args.get("symbol_id").and_then(|v| v.as_str()).unwrap_or("");
                let graph = self.graph.read().await;
                let (nodes, _edges) = graph.metrics();
                
                Ok(json!({
                    "content": [{
                        "type": "text",
                        "text": format!("Impact analysis for '{}'. Graph has {} nodes.", target_symbol, nodes)
                    }],
                    "isError": false
                }))
            }
            "get_context" => {
                let target_symbol = args.get("symbol_id").and_then(|v| v.as_str()).unwrap_or("");
                Ok(json!({
                    "content": [{
                        "type": "text",
                        "text": format!("Context for '{}': [Mock dependencies listed here]", target_symbol)
                    }],
                    "isError": false
                }))
            }
            _ => Err(Error::protocol(ErrorCode::MethodNotFound, "Unknown tool")),
        }
    }

    /// Exposes available tools
    async fn list_tools(&self) -> Result<serde_json::Value, Error> {
        Ok(json!({
            "tools": [
                {
                    "name": "get_impact",
                    "description": "Calculates the blast radius if a specific symbol/function is modified.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "symbol_id": { "type": "string" }
                        },
                        "required": ["symbol_id"]
                    }
                },
                {
                    "name": "get_context",
                    "description": "Gets the full 360-degree context of a symbol (callers, callees, implementations).",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "symbol_id": { "type": "string" }
                        },
                        "required": ["symbol_id"]
                    }
                }
            ]
        }))
    }
}

#[async_trait]
impl ServerHandler for CodeCortexMcp {
    async fn initialize(
        &self,
        _implementation: Implementation,
        _capabilities: ClientCapabilities,
    ) -> Result<ServerCapabilities, Error> {
        Ok(ServerCapabilities {
            experimental: None,
            prompts: None,
            resources: None,
            tools: Some(json!({ "listChanged": false })),
            logging: None,
        })
    }

    async fn shutdown(&self) -> Result<(), Error> {
        tracing::info!("CodeCortex MCP shutting down.");
        Ok(())
    }

    async fn handle_method(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, Error> {
        tracing::info!("MCP Method called: {}", method);
        
        match method {
            "tools/list" => self.list_tools().await,
            "tools/call" => {
                let p = params.clone().unwrap_or_default();
                let tool_name = p.get("name").and_then(|n| n.as_str()).unwrap_or("");
                self.call_tool(tool_name, params).await
            }
            _ => Err(Error::protocol(ErrorCode::MethodNotFound, method)),
        }
    }
}

/// A mock stdio transport (as mcp_sdk_rs doesn't expose stdio by default in 0.3.4)
struct StdioTransport;

#[async_trait]
impl Transport for StdioTransport {
    async fn send(&self, _message: Message) -> Result<(), Error> {
        // Send to stdout logic
        Ok(())
    }

    fn receive(&self) -> std::pin::Pin<Box<dyn futures::Stream<Item = Result<Message, Error>> + Send + 'static>> {
        // Receive from stdin logic
        Box::pin(futures::stream::empty())
    }

    async fn close(&self) -> Result<(), Error> {
        Ok(())
    }
}

/// The exposed public function to run the MCP server on stdio
pub async fn run_stdio(graph: Arc<RwLock<CodeGraph>>) -> anyhow::Result<()> {
    tracing::info!("Starting MCP Handler...");
    
    let handler = Arc::new(CodeCortexMcp::new(graph));
    let transport = Arc::new(StdioTransport);
    
    let server = Server::new(transport, handler);
    server.start().await.map_err(|e| anyhow::anyhow!("Server error: {}", e))?;
    
    Ok(())
}
