use std::path::Path;
use tokio::fs;

const AGENTS_MD_TEMPLATE: &str = r#"<!-- codecortex:start -->
# CodeCortex MCP Environment

This project is semantically indexed by **CodeCortex**.

## Always Start Here
1. **Request the graph status** via MCP before answering codebase questions.
2. If the data is stale, direct the user to run `codecortex analyze`.
3. Read the relevant skills below to match your workflow.

## Available Workflows
| Task | Read this skill file |
|------|---------------------|
| Understand architecture / Trace execution | `.claude/skills/codecortex/exploring/SKILL.md` |
| Impact Analysis & Blast Radius | `.claude/skills/codecortex/impact/SKILL.md` |
| Safe Refactoring & Code Splitting | `.claude/skills/codecortex/refactor/SKILL.md` |

<!-- codecortex:end -->
"#;

const EXPLORING_SKILL: &str = r#"---
name: CodeCortex Exploring
description: How to safely understand architecture.
---
# Architectural Exploration
Always use the `get_context` MCP tool to analyze all callers and dependencies of a symbol deeply. Do not rely heavily on text-search.
"#;

const IMPACT_SKILL: &str = r#"---
name: CodeCortex Impact
description: Checking the blast radius of changes.
---
# Impact Analysis
Before modifying any heavily used function, assert the exact blast radius using the `get_impact` MCP tool.
"#;

/// Generates the AGENTS.md guide and `.claude/skills/codecortex/` directories safely
pub async fn seed_workspace(repo_path: &Path) -> anyhow::Result<()> {
    // 1. Write AGENTS.md
    let agents_path = repo_path.join("AGENTS.md");
    if !agents_path.exists() {
        fs::write(&agents_path, AGENTS_MD_TEMPLATE).await?;
        tracing::info!("Created AGENTS.md at {:?}", agents_path);
    }

    // 2. Scaffold Skills Dir
    let skills_dir = repo_path.join(".claude/skills/codecortex");
    fs::create_dir_all(&skills_dir.join("exploring")).await?;
    fs::create_dir_all(&skills_dir.join("impact")).await?;
    fs::create_dir_all(&skills_dir.join("refactor")).await?;
    
    // 3. Write Skills Files
    fs::write(skills_dir.join("exploring/SKILL.md"), EXPLORING_SKILL).await?;
    fs::write(skills_dir.join("impact/SKILL.md"), IMPACT_SKILL).await?;
    
    tracing::info!("Seeded Claude skills successfully in {:?}", skills_dir);
    
    Ok(())
}
