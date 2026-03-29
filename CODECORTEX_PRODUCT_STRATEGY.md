# CodeCortex Product Strategy & Roadmap

## 1. What CodeCortex Currently Does
CodeCortex is an architectural intelligence platform designed to build a "nervous system" for AI agents and human developers. It ingests any codebase locally, generates a deep, precomputed knowledge graph (using KuzuDB and Tree-sitter), and resolves cross-file dependencies to provide 360-degree context. 

Unlike traditional IDE features that just do text-search, CodeCortex structurally understands how your code is wired together, which provides several "sticky" features that standard IDEs simply cannot offer out of the box:
- **Instant Blast Radius / Impact Analysis:** Pinpoint *exactly* what downstream services will break if you modify a core function or interface.
- **Taint Analysis (Follow-the-Data):** Security path tracing that uncovers how API payloads touch database layers or vulnerable sinks across module boundaries.
- **Architectural Guardrails Engine:** Identifies dependency drift and domain violations (e.g., UI layer bypassing controllers and talking straight to the DB).
- **Zero-Config Agent Hook-ins:** Out-of-the-box MCP integration that makes your existing local agents (Claude Code, Cursor, Windsurf) instantly aware of your entire system's graph, making their edits astronomically more reliable.
- **Time-Series Health Telemetry:** Tracks structural degradation over time seamlessly on every CLI ingestion—including Dead Code %, Module/Community Cohesion, Circular Dependencies, and Codebase Coupling. 

## 2. Completed Milestones
We have aggressively resolved critical gaps preventing this from becoming a paid, enterprise-ready platform:

✅ **Phase 1: Real-World Usability & Health Analytics**
- Demo Repository Onboarding (Gap 1)
- Bus Factor Calculator to track critical knowledge silos (Gap 4)
- Automated Dead Code Tracking and Reporting (Gap 7)
- Resolution of Ghost Town structural metrics + PR Depth slider adjustments.

✅ **Phase 2: Security & Documentation Autonomy**
- Security Trace Paths & Taint Analysis Dashboard (Gap 5)
- LLM-Free Wiki / Structure Documentation rendering (Gap 8)
- Upgraded `generator.ts` and `structural-renderer.ts` for instant structural wikis.

✅ **Phase 3: The Architecture Health Engine**
- `HealthTrendDashboard.tsx` visualization embedded in the dashboard UI.
- Direct KuzuDB query hooks computing real-time:
  - Average Coupling Scores
  - Structural Circular Dependencies
  - Mean Cohesion Index (from Leiden Communities)
  - Time-Series Snapshot logic wired into `codecortex analyze`.
- `/api/health-history` API natively exposed to the Web Frontend and MCP resources.

*(Note: The Web Frontend including these updates was successfully deployed to Vercel at `https://c-alpha-whale.vercel.app` & `https://c-hzhkiw8n6-alpha-whale.vercel.app`)*

## 3. What's Pending (Short-Term Execution)
These are the remaining tactical gaps that bridge the system strictly into the developer workflows:

⏳ **Phase 4: VS Code Extension (Gap 6)**
- Sub-second blast radius hints delivered straight inside the IDE inline (e.g., via `Ctrl+Shift+C` hover commands).
- Requires a `codecortex-vscode` package that polls the local MCP HTTP endpoint/server.

⏳ **Phase 5: GitHub Application / PR Review Bot (Gap 2)**
- Automating the `codecortex analyze` impact checker as a CI/CD job.
- Deploying a GitHub app webhook that detects the blast radius of a PR and posts automated structural warnings.

## 4. What We Are Thinking To Build Next (Phase 6 - Enterprise Tier)
Moving forward, we are eyeing the jump to a massive **$10M+ Enterprise B2B SaaS** play by providing true oversight.
- **Time-Machine Architecture (Evolution Tracking):** Temporal graph snapshots to scroll through codebase history (months/years) visualising precisely *when* and *where* architecture became spaghetti.
- **AI "Auto-Architect":** An intelligent orchestrator that generates actionable refactoring roadmaps for "God Files", using complex community detection to suggest safe module splitting boundaries.
- **Enterprise Cross-Repo Mapping:** Expanding the knowledge graph scale beyond monorepos to track massive microservice environments and inter-repo API contracts (`Repository[]` state refactor).
- **Proactive Guardrails:** Hard enforcement of team-defined domain driven structures ("UI cannot import DB"), turning CodeCortex into an architectural linter that fails CI.

*This strategy cements CodeCortex not just as a visualizer, but an indispensable safety net that engineering leaders will gladly sponsor.*
