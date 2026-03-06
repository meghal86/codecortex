# CodeCortex Enterprise Tier (Phase 6) - Roadmap & To-Do List

This document outlines the 5 visionary features required to elevate CodeCortex from a visualization tool into a $10M+ actionable architectural intelligence platform.

## 1. ⏱️ Time-Machine Architecture (Evolution Tracking)
**Goal:** Allow users to scrub through Git history to visualize architectural evolution and tech debt accumulation.
- [ ] Extend \`git-processor.ts\` or create a temporal parser to ingest commit history.
- [ ] Build temporal graph snapshots.
- [ ] Add a bottom timeline scrubber component (\`src/components/TimelineScrubber.tsx\`).
- [ ] Implement logic to swap active graph instance/filter nodes based on selected timestamp.

## 2. 🛠️ AI "Auto-Architect" (Actionable Refactoring)
**Goal:** Generate actionable refactoring plans for complex "God Files" and architectural hotspots directly from the graph.
- [ ] Add a "Draft Refactor Plan" action to the Node Details sidebar (visible on hotspots).
- [ ] Create a specialized LangChain prompt within \`src/core/llm/\` that analyzes dependencies to propose a file split.
- [ ] Render the output as an interactive modal or downloadable markdown document.

## 3. 🌐 Enterprise Cross-Repo Mapping
**Goal:** Ingest and visualize relationships between entirely separate repositories (e.g., Microservices).
- [ ] Modify global state (\`src/store/\`) to support an array of \`Repository\` objects instead of a single instance.
- [ ] Create \`cross-repo-processor.ts\` to search for API contracts across repos (e.g., \`fetch('/api/users')\` <-> \`app.get('/api/users')\`).
- [ ] Render repos as massive distinct super-clusters connected via API nodes.

## 4. 🚨 Architectural Guardrails (Drift Detection)
**Goal:** Enforce architectural rules (e.g., UI cannot import DB) and flag violations in real-time.
- [ ] Build a \`guardrails-engine.ts\` to accept user-defined rule schemas.
- [ ] Add a \`violation\` property to \`EdgeProperties\`.
- [ ] Render violating edges as flashing red dashed lines.
- [ ] Add a "Guardrails" configuration panel to define rules and summarize violations.

## 5. 🌊 "Follow-the-Data" Taint Analysis
**Goal:** Trace the exact execution path from an API endpoint down into the database layer.
- [ ] Extend \`graphFilter.ts\` to implement directed breadth-first search (BFS) from a chosen entry node.
- [ ] Add a "Trace Data Flow" button to the selected node panel.
- [ ] Highlight the path by dimming non-essential nodes and emphasizing sequential edges.
