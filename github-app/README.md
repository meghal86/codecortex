# CodeCortex GitHub App

**Zero-configuration architectural impact analysis on every PR.**

## The "Never Seen This Before" Moment

A developer opens a GitHub PR, and they see a comment that says:

> "This change touches `AuthService` which is the most connected node in your system — 31 functions across 6 modules depend on it. Your architectural rule 'UI layer should not call DB layer directly' has been violated in 2 places. Estimated risk: High."

That developer stops. They read it. They think "how did it know that?" Then they fix the violation before it gets to code review. Their senior engineer doesn't have to spend 45 minutes in review explaining a principle that's been in the team's unwritten rulebook for two years.

## How It Works

1. **Install the GitHub App** — Click "Install", select your repo
2. **Open a PR** — Within 5 minutes, your next PR has a CodeCortex comment
3. **See the impact** — Blast radius, architectural violations, affected processes
4. **Fix before review** — Catch structural issues before they reach code review

## What It Analyzes

### 🎯 Blast Radius
- Which symbols are highly connected (critical nodes)
- How many callers depend on your changes
- Depth of impact (direct vs transitive)

### 🏗️ Architectural Violations
- UI layer directly accessing database
- Controllers importing business logic
- Circular dependencies
- Custom rules you define

### 💥 Affected Processes
- Which execution flows trace through your changes
- Which steps in each flow are affected
- What needs manual testing

## Example Comment

```markdown
## 🚨 CodeCortex Impact Analysis

### CRITICAL RISK

| Metric | Value |
|--------|-------|
| Changed Files | 3 |
| Modified Symbols | 5 |
| Affected Processes | 2 |
| Architectural Violations | 1 |

### 📊 Summary

🚨 **1 critical symbol(s)** modified — these are highly connected nodes
🏗️ **1 architectural violation(s)** detected
🔄 **2 execution flow(s)** affected

### 🚨 Critical Symbols Modified

- **`AuthService.validateToken`** (Function)
  - 📍 File: `src/auth/service.ts`
  - 👥 Callers: 47
  - 📊 Depth: 3

### 🏗️ Architectural Violations

- **UI-DB Direct Access**
  - UI layer should not directly access database layer
  - 📍 Locations: `src/components/UserProfile.tsx`

### 💥 Blast Radius (Affected Processes)

<details><summary>`UserLogin Flow`</summary>

- **Type:** Execution Flow
- **Total Steps:** 8
- **Affected Steps:** 3

</details>
```

## Setup

### For Repository Owners

1. Go to [github.com/apps/codecortex](https://github.com/apps/codecortex)
2. Click "Install"
3. Select the repositories you want to analyze
4. That's it! Every PR will now get an impact analysis comment

### For Self-Hosting

```bash
# Clone the repository
git clone https://github.com/codecortex/github-app.git
cd github-app

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GitHub App credentials

# Start the server
npm start
```

## Configuration

### Environment Variables

```env
# GitHub App credentials
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY=your_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# CodeCortex service (optional - for enhanced analysis)
CODECORTEX_API_URL=http://localhost:4747
```

### Custom Architectural Rules

Create a `.codecortex/rules.json` file in your repository:

```json
{
  "rules": [
    {
      "name": "UI-DB Direct Access",
      "description": "UI layer should not directly access database layer",
      "pattern": "import.*(?:database|db|sequelize|prisma|mongoose)",
      "layers": ["ui", "components"],
      "forbidden": ["database", "db"]
    },
    {
      "name": "Controller-Service Separation",
      "description": "Controllers should not directly import business logic",
      "pattern": "import.*(?:controller|handler).*import.*(?:service|business)",
      "layers": ["controller"],
      "forbidden": ["service", "business"]
    }
  ]
}
```

## Integration with CodeCortex CLI

The GitHub App works standalone, but gets enhanced analysis when paired with the CodeCortex CLI:

```bash
# Index your repository locally
codecortex analyze

# The GitHub App will use the local index for deeper analysis
```

## Why This Is Different

| Tool | What It Knows | What It Doesn't Know |
|------|---------------|---------------------|
| **Snyk** | Your npm package has a CVE | That removing `validateInput` breaks 23 callers |
| **SonarQube** | Function has cyclomatic complexity of 47 | That refactoring it cascades through auth flow |
| **CodeCortex** | Both — and your architectural rules | Nothing about your codebase structure |

## The Sticky Loop

CodeCortex inserts into the workflow you already have:

1. **GitHub** — Comments on every PR automatically
2. **IDE** — VS Code sidebar showing blast radius (coming soon)
3. **AI Assistant** — Pre-tool-use hook for Claude Code/Cursor (already built)

## License

MIT
