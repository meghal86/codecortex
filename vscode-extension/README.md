# CodeCortex VS Code Extension

**Blast radius analysis and architectural guardrails directly in your IDE.**

## The "Never Seen This Before" Moment

You're editing `AuthService.validateToken()` and you see an inline hint:

```
👥 47 callers | 📊 Depth 3 | 🚨 CRITICAL
```

You stop. You realize this function is the most connected node in your system. You think twice before making changes. Your senior engineer doesn't have to spend 45 minutes in review explaining why this function is fragile.

## Features

### 🎯 Inline Blast Radius Hints

When you hover over a function or class, you see:
- How many callers depend on it
- How deep the impact goes (depth 1, 2, or 3)
- Risk level (LOW / MEDIUM / HIGH / CRITICAL)

### 🏗️ Architectural Guardrails

Before you commit, check if your changes violate architectural rules:
- UI layer directly accessing database
- Controllers importing business logic
- Circular dependencies
- Test files importing production code

### 📊 Status Bar Integration

The status bar shows the risk level of your current file:
- ✅ LOW RISK — Safe to modify
- 🔶 MEDIUM RISK — Review carefully
- ⚠️ HIGH RISK — Significant downstream impact
- 🚨 CRITICAL RISK — Highly connected node

### 🔍 Right-Click Analysis

Right-click on any symbol to:
- Analyze impact (blast radius)
- Check guardrails (architectural violations)
- Show full blast radius visualization

## Setup

### Prerequisites

1. Install CodeCortex CLI:
   ```bash
   npm install -g codecortex
   ```

2. Index your repository:
   ```bash
   codecortex analyze
   ```

3. Start the CodeCortex server:
   ```bash
   codecortex serve
   ```

### Install Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "CodeCortex"
4. Click Install

### Configuration

Open VS Code settings and search for "CodeCortex":

| Setting | Default | Description |
|---------|---------|-------------|
| `codecortex.serverUrl` | `http://localhost:4747` | CodeCortex server URL |
| `codecortex.autoAnalyze` | `true` | Automatically analyze impact when opening files |
| `codecortex.showInlineHints` | `true` | Show blast radius hints inline in the editor |

## Usage

### Automatic Analysis

When you open a file, CodeCortex automatically:
1. Analyzes the file's blast radius
2. Updates the status bar with risk level
3. Shows inline hints for symbols at your cursor

### Manual Analysis

1. **Right-click** on a symbol
2. Select **"CodeCortex: Analyze Impact"**
3. See the full blast radius in a side panel

### Check Guardrails

1. **Right-click** on a symbol
2. Select **"CodeCortex: Check Guardrails"**
3. See any architectural violations

### Show Blast Radius

1. **Right-click** on a symbol
2. Select **"CodeCortex: Show Blast Radius"**
3. See a visual representation of all affected symbols

## How It Works

The extension connects to your local CodeCortex server (running on `localhost:4747`) and queries the knowledge graph to:

1. **Find callers** — Who depends on this symbol?
2. **Calculate depth** — How far does the impact spread?
3. **Assess risk** — How critical is this symbol?
4. **Check rules** — Does this change violate architectural rules?

## Why This Is Different

| Feature | VS Code IntelliSense | CodeCortex |
|---------|---------------------|------------|
| Find references | ✅ Yes | ✅ Yes |
| Show callers | ❌ No | ✅ Yes |
| Calculate blast radius | ❌ No | ✅ Yes |
| Assess risk level | ❌ No | ✅ Yes |
| Check architectural rules | ❌ No | ✅ Yes |
| Show affected processes | ❌ No | ✅ Yes |

## The Sticky Loop

CodeCortex inserts into the workflow you already have:

1. **GitHub** — Comments on every PR automatically
2. **IDE** — VS Code sidebar showing blast radius (this extension)
3. **AI Assistant** — Pre-tool-use hook for Claude Code/Cursor (already built)

## Troubleshooting

### "CodeCortex server not running"

Make sure you've started the server:
```bash
codecortex serve
```

### "No indexed repositories"

Make sure you've indexed your repository:
```bash
codecortex analyze
```

### "Connection refused"

Check that the server URL is correct in VS Code settings:
- Default: `http://localhost:4747`
- Custom: Update `codecortex.serverUrl` in settings

## License

MIT
