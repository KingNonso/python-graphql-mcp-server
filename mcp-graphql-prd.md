# Product Requirements Document
## Django GraphQL → AI Workflow Acceleration via MCP

**Title:** Direct MCP Server from GraphQL (Pattern A) + Separate Process Architecture (Option 1)  
**Using:** mcp-graphql (Open Source)  
**Status:** Ready for Implementation  
**Date:** January 26, 2026  
**Context:** Django GraphQL Backend + Next.js Frontend + Local Development

---

## Executive Summary

Implement a local MCP (Model Context Protocol) server that exposes your Django GraphQL backend, enabling Claude/Cursor/ChatGPT to introspect your schema and generate code automatically. This accelerates AI-assisted workflows for frontend schema generation, query optimization, and boilerplate creation.

**Key Outcome:** Claude can examine your GraphQL schema and generate type-safe frontend code, queries, and mutations in real-time during development.

---

## Problem Statement

### Current Workflow Pain Points
1. **Manual schema synchronization** - Frontend types manually maintained separately from backend schema
2. **AI context gaps** - Claude doesn't understand your GraphQL structure without manual explanation
3. **Query generation friction** - Writing GraphQL queries requires context switching and documentation lookup
4. **Frontend boilerplate overhead** - React hooks, Apollo setup, type definitions created manually

### Desired Outcome
- Claude can **see your live GraphQL schema** instantly
- Generate **type-safe queries and mutations** from natural language descriptions
- Produce **ready-to-use React components** with correct types
- **Zero manual schema documentation** needed

---

## Solution Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Dev Machine                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Port 8000                          │  │
│  │         Django GraphQL Backend (Running)             │  │
│  │  • Graphene schema definition                         │  │
│  │  • Introspection enabled (dev only)                  │  │
│  │  • localhost:8000/graphql                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                         △ GraphQL endpoint                   │
│                         │                                    │
│                         │ queries                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Port 5000                          │  │
│  │        MCP Server (mcp-graphql process)              │  │
│  │  • Introspects schema from :8000/graphql             │  │
│  │  • Exposes 2 MCP tools:                              │  │
│  │    - introspect_graphql_schema                       │  │
│  │    - execute_graphql_query                           │  │
│  │  • Listens on stdio (for Claude Desktop/Cursor)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                         △ MCP protocol (stdio)               │
│                         │                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Claude/Cursor/ChatGPT                   │  │
│  │  • Calls introspect_graphql_schema                   │  │
│  │  • Understands your schema structure                 │  │
│  │  • Generates queries/mutations                       │  │
│  │  • Calls execute_graphql_query to test               │  │
│  │  • Produces frontend code                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Next.js Frontend (Optional)               │  │
│  │  • Can also call MCP tools if configured             │  │
│  │  • Receives generated code                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Rationale

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| **MCP Tool Type** | Direct GraphQL Exposure | Zero Python code; uses existing Graphene schema |
| **Process Model** | Separate from Django | Decoupled, independent lifecycle, easier debugging |
| **Transport** | stdio (vs SSE) | Claude Desktop/Cursor native support; simpler auth |
| **Hosting** | localhost:5000 | Local development; no network overhead |
| **Schema Source** | Live introspection | Always in sync; no build steps |

---

## Requirements

### Functional Requirements

#### FR1: Schema Introspection Tool
**Requirement:** MCP server exposes introspection capability  
**Details:**
- Tool name: `introspect_graphql_schema`
- Tool description: "Fetch the complete GraphQL schema from your Django backend"
- Accepts: (no parameters)
- Returns: Full GraphQL schema introspection JSON (types, fields, descriptions, arguments)
- Response time: < 500ms (local network)
- Error handling: Clear messages if backend unreachable

**Success Criteria:**
- Claude calls tool → receives schema within 500ms
- Schema includes all custom types, queries, mutations, subscriptions
- Field descriptions and deprecation warnings present
- Argument types and defaults accurate

#### FR2: Query Execution Tool
**Requirement:** MCP server executes GraphQL queries safely  
**Details:**
- Tool name: `execute_graphql_query`
- Tool description: "Execute GraphQL queries/mutations against your Django backend"
- Accepts:
  - `query_string` (string): Valid GraphQL query or mutation
  - `variables` (optional object): Query variables
- Returns: GraphQL response (data or errors)
- Authorization: Respects Django authentication (via headers)
- Scope: Query-only by default; mutations disabled unless explicitly configured

**Success Criteria:**
- Claude submits valid query → receives data
- Invalid queries → clear error messages with suggestions
- Mutations blocked unless `ALLOW_MUTATIONS=true` set
- Response includes GraphQL errors, validation errors clearly

#### FR3: Environment Configuration
**Requirement:** Configuration via environment variables (no hardcoding)  
**Details:**
- Primary variables:
  - `ENDPOINT`: Django GraphQL URL (default: `http://localhost:8000/graphql`)
  - `HEADERS`: JSON string for auth headers (default: `{}`)
  - `ALLOW_MUTATIONS`: Boolean flag (default: `false`)
  - `NAME`: MCP server display name (default: `mcp-graphql`)
  - `SCHEMA`: Optional path to local `.graphql` schema file

**Success Criteria:**
- Can run with zero config (uses sensible defaults)
- `.env` file loads correctly
- Shell script injection of env vars works
- Secure header handling (no logging of auth tokens)

#### FR4: Authentication Support
**Requirement:** Support Django authentication mechanisms  
**Details:**
- Bearer token support via `Authorization: Bearer <token>` header
- Custom headers for API keys or other auth schemes
- CORS-aware (if cross-origin needed)
- No credential storage; pass-through only

**Success Criteria:**
- Authenticated Django queries execute correctly
- Token refresh handled (if backend supports)
- Secure header passing to backend
- No credentials logged or exposed

### Non-Functional Requirements

#### NFR1: Performance
- Schema introspection: < 500ms first time, < 100ms cached
- Query execution: Depends on backend, but MCP adds < 50ms overhead
- Memory footprint: < 100MB RSS
- Startup time: < 2 seconds

#### NFR2: Reliability
- Graceful handling of backend unavailability
- Auto-reconnection attempts (exponential backoff)
- Clear error messages for troubleshooting
- Logging of errors (no token leakage)

#### NFR3: Security (Local Dev Context)
- Schema introspection enabled only in dev (disabled in production)
- No credential storage (pass-through auth only)
- HTTPS support for remote backends (optional)
- GraphQL query depth limits (optional for backend protection)

#### NFR4: Maintainability
- Single `.env` file configuration
- Clear documentation for setup and troubleshooting
- Compatible with Node.js 18+
- Works with npm, pnpm, yarn

---

## Implementation Details

### Phase 1: Setup & Initialization (Day 1)

#### 1.1 Project Structure

```
your-project-root/
├── backend/
│   ├── manage.py
│   ├── myapp/
│   │   └── schema.py  (Graphene schema)
│   └── requirements.txt
│
├── frontend/
│   ├── package.json
│   └── src/
│
└── mcp-server/                  ← NEW
    ├── package.json
    ├── .env                      ← Create locally (not in git)
    ├── .env.example              ← Template (commit to git)
    ├── start-mcp-graphql.sh      ← Shell wrapper
    └── README.md                 ← Setup guide
```

#### 1.2 Initialize MCP Server Directory

```bash
# From project root
mkdir mcp-server && cd mcp-server

# Create package.json
cat > package.json << 'EOF'
{
  "name": "django-graphql-mcp",
  "version": "1.0.0",
  "description": "MCP server exposing Django GraphQL for AI workflows",
  "type": "module",
  "scripts": {
    "start": "node start.js",
    "dev": "npm start"
  },
  "dependencies": {
    "mcp-graphql": "^1.1.0"
  },
  "devDependencies": {
    "dotenv": "^16.0.0"
  }
}
EOF

npm install
```

#### 1.3 Create Environment Configuration

```bash
# .env.example (commit to git - template only)
ENDPOINT=http://localhost:8000/graphql
HEADERS={}
ALLOW_MUTATIONS=false
NAME=django-graphql-mcp
SCHEMA=
```

```bash
# .env (local only - add to .gitignore)
ENDPOINT=http://localhost:8000/graphql
HEADERS={}
ALLOW_MUTATIONS=false
NAME=django-graphql-mcp
SCHEMA=

# If using authentication:
# HEADERS={"Authorization":"Bearer YOUR_TOKEN_HERE"}
```

Add to `.gitignore`:
```
mcp-server/.env
mcp-server/node_modules/
mcp-server/.env.local
```

#### 1.4 Create Shell Wrapper Script

```bash
# mcp-server/start-mcp-graphql.sh
#!/usr/bin/env bash

set -a
# Load environment variables from .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi
set +a

# Export for subprocess
export ENDPOINT
export HEADERS
export ALLOW_MUTATIONS
export NAME
export SCHEMA

# Run mcp-graphql
npx mcp-graphql
```

Make executable:
```bash
chmod +x mcp-server/start-mcp-graphql.sh
```

### Phase 2: Verification & Testing (Day 1, ~30 min)

#### 2.1 Start Django Backend (Terminal 1)
```bash
cd backend
python manage.py runserver 8000
# Output: Starting development server at http://127.0.0.1:8000/
# Verify: Visit http://localhost:8000/graphql - GraphiQL should load
```

#### 2.2 Test MCP Server Manually (Terminal 2)
```bash
cd mcp-server

# Test basic startup
ENDPOINT=http://localhost:8000/graphql npx mcp-graphql

# Should output something like:
# [mcp-graphql] Connected to http://localhost:8000/graphql
# [mcp-graphql] MCP server running on stdio
# [mcp-graphql] Tools registered: introspect_graphql_schema, execute_graphql_query
```

#### 2.3 Verify Schema Introspection (Manual Test)
```bash
# Use MCP Inspector (https://inspector.modelcontextprotocol.io/)
# or create a simple test script

# Test script (test-mcp.js):
cat > mcp-server/test-mcp.js << 'EOF'
import { spawn } from 'child_process';
import fs from 'fs';

// Load env
const env = Object.assign({}, process.env);
const envFile = fs.readFileSync('.env', 'utf8');
envFile.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        env[key] = value;
    }
});

const server = spawn('npx', ['mcp-graphql'], { env });

server.stdout.on('data', (data) => {
    console.log(`[stdout] ${data}`);
});

server.stderr.on('data', (data) => {
    console.error(`[stderr] ${data}`);
});

setTimeout(() => server.kill(), 5000);
EOF

node test-mcp.js
```

#### 2.4 Django GraphQL Introspection Check

Ensure introspection is enabled:
```python
# backend/myapp/schema.py
import graphene
from graphql import GraphQLSchema

# For Graphene, introspection is enabled by default
# Verify it's working:
# curl -X POST http://localhost:8000/graphql \
#   -H "Content-Type: application/json" \
#   -d '{"query":"{ __schema { types { name } } }"}'

# Should return a list of all GraphQL types
```

### Phase 3: Claude Desktop Configuration (Day 1, ~10 min)

#### 3.1 Find Configuration File

**macOS/Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

#### 3.2 Add MCP Server Configuration

```json
{
  "mcpServers": {
    "django_graphql": {
      "command": "bash",
      "args": ["/path/to/your/project/mcp-server/start-mcp-graphql.sh"]
    }
  }
}
```

Replace `/path/to/your/project` with your actual absolute path.

**Example (macOS):**
```json
{
  "mcpServers": {
    "django_graphql": {
      "command": "bash",
      "args": ["/Users/username/projects/myapp/mcp-server/start-mcp-graphql.sh"]
    }
  }
}
```

#### 3.3 Restart Claude Desktop
1. Completely quit Claude Desktop
2. Reopen it
3. Click the 🔌 icon (bottom toolbar) to see connected MCP servers
4. Should show `django_graphql` as connected

### Phase 4: Cursor Configuration (Day 1, ~10 min)

#### 4.1 Open Cursor Settings

1. Cursor → Settings → Features → MCP
2. Click "Add MCP Server"

#### 4.2 Add Configuration

```json
{
  "command": "bash",
  "args": ["/path/to/your/project/mcp-server/start-mcp-graphql.sh"]
}
```

Name: `django_graphql`

#### 4.3 Test Connection
1. In Cursor, open the MCP panel (bottom right)
2. Should list: `introspect_graphql_schema` and `execute_graphql_query` tools
3. Click "Test Tools" to verify

### Phase 5: Usage & Testing (Day 2)

#### 5.1 First Claude Query (Ask Claude in Claude Desktop)

```
I have a Django GraphQL backend. Can you first introspect my schema 
to see what's available, then tell me what queries are available?
```

Claude will:
1. Call `introspect_graphql_schema` tool
2. Parse your schema
3. Summarize available queries, mutations, fields

#### 5.2 Generate Query

```
Based on the schema, write me a GraphQL query to fetch all users 
with their email addresses. Then execute it to test.
```

Claude will:
1. Generate appropriate GraphQL query
2. Call `execute_graphql_query` to run it
3. Show you the results
4. Provide TypeScript type definitions

#### 5.3 Generate React Hook

```
Create a React hook that fetches users from my GraphQL backend 
and returns loading, error, and data states.
```

Claude will:
1. Reference the schema from earlier introspection
2. Generate a custom hook with Apollo Client (or preferred library)
3. Include proper TypeScript types
4. Ready to copy-paste into your Next.js app

#### 5.4 Test Mutation (if enabled)

```
// First, set in .env:
ALLOW_MUTATIONS=true

# Then ask Claude:
Write me a mutation to create a new user and execute it as a test.
```

---

## Configuration Reference

### Environment Variables

| Variable | Type | Default | Required | Notes |
|----------|------|---------|----------|-------|
| `ENDPOINT` | string | `http://localhost:8000/graphql` | No | Your Django GraphQL endpoint |
| `HEADERS` | JSON string | `{}` | No | Auth headers, e.g. `{"Authorization":"Bearer TOKEN"}` |
| `ALLOW_MUTATIONS` | boolean | `false` | No | Enable mutation execution (false by default for safety) |
| `NAME` | string | `mcp-graphql` | No | Display name for MCP server |
| `SCHEMA` | path | _(none)_ | No | Path to local `.graphql` file instead of introspection |

### .env Example (With Authentication)

```bash
# Basic setup
ENDPOINT=http://localhost:8000/graphql
ALLOW_MUTATIONS=false

# With Bearer token
HEADERS={"Authorization":"Bearer sk_dev_1234567890abcdef"}

# With API Key
HEADERS={"X-API-Key":"your-api-key-here"}

# Multiple headers
HEADERS={"Authorization":"Bearer TOKEN","X-Custom-Header":"value"}

# Allow mutations (use with caution!)
ALLOW_MUTATIONS=true
```

### Claude Desktop Config Example

```json
{
  "mcpServers": {
    "django_graphql_dev": {
      "command": "bash",
      "args": ["/Users/yourname/projects/myapp/mcp-server/start-mcp-graphql.sh"],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

### Cursor Config Example

```json
{
  "mcpServers": {
    "django_graphql": {
      "command": "bash",
      "args": ["${workspaceFolder}/mcp-server/start-mcp-graphql.sh"]
    }
  }
}
```

---

## Workflow Examples

### Scenario 1: Generate Frontend Schema from Backend

**Goal:** Create TypeScript types for your Next.js app from Django GraphQL schema

```
User: "I need TypeScript types for all my GraphQL queries. 
       First, introspect my schema, then generate the types file."

Claude:
1. Calls introspect_graphql_schema
2. Receives full schema
3. Generates types.ts with all types
4. Provides copy-paste code for Next.js
```

**Output:** Ready-to-use TypeScript file with all types matching your backend

### Scenario 2: Generate & Test a Query

**Goal:** Create a query to fetch users and verify it works

```
User: "Write me a GraphQL query that fetches users with pagination.
       Test it against my backend."

Claude:
1. References schema from introspection
2. Writes GraphQL query with first/after variables
3. Calls execute_graphql_query with test variables
4. Shows results or error
5. Provides React hook code using Apollo
```

**Output:** Working query + reusable React hook

### Scenario 3: Optimize Query Performance

**Goal:** Improve an existing query

```
User: "I have a slow query that fetches posts with comments.
       Show me the issue and optimize it."

Claude:
1. Looks at current query
2. Introspects schema for available fields
3. Suggests optimizations (batching, limiting)
4. Tests optimized version with execute_graphql_query
5. Shows performance comparison
```

**Output:** Optimized query with better performance

---

## Security & Production Considerations

### Local Development (Current Setup)
✅ **Safe for:**
- Local only (no network exposure)
- Introspection enabled for AI access
- Mutations disabled by default
- Zero credential storage

❌ **Not suitable for:**
- Production environments
- Public network exposure
- Sensitive data operations

### Transition to Production
When ready to move to production:

1. **Disable introspection** on public endpoint
2. **Use separate GraphQL endpoint** for MCP (internal only)
3. **Add authentication** to MCP server itself
4. **Implement rate limiting** on MCP queries
5. **Use dedicated MCP service** (not alongside Django)

---

## Troubleshooting Guide

### Issue: "Cannot connect to Django backend"

**Diagnosis:**
```bash
# Check Django is running
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

**Solutions:**
- Verify Django running: `python manage.py runserver 8000`
- Check ENDPOINT in `.env`: should be `http://localhost:8000/graphql`
- Check firewall: is port 8000 accessible?

### Issue: "MCP server won't start"

**Solutions:**
1. Update mcp-graphql: `npm install -g mcp-graphql@latest`
2. Check Node version: `node --version` (should be 18+)
3. Verify npm packages installed: `npm install`
4. Check .env syntax: `echo $ENDPOINT` should output URL

### Issue: "Claude can't see MCP tools"

**Solutions:**
1. Restart Claude Desktop completely
2. Check config file path (correct OS location)
3. Verify shell script is executable: `chmod +x start-mcp-graphql.sh`
4. Test script directly: `./start-mcp-graphql.sh`

### Issue: "Authentication not working"

**Solutions:**
1. Verify HEADERS JSON is valid: `echo $HEADERS | jq .`
2. Test auth header: 
   ```bash
   curl -X POST http://localhost:8000/graphql \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __schema { types { name } } }"}'
   ```
3. Check Django authentication backend supports tokens

### Issue: "Mutations returning 'not allowed'"

**Solution:**
- Set `ALLOW_MUTATIONS=true` in `.env` if mutations are intended
- Restart MCP server after changing .env

---

## Deployment & Scaling

### Local Development (Current)
```
Laptop
  ├── Django :8000
  └── MCP Server :5000 (stdio)
       └── Claude Desktop/Cursor
```

**Characteristics:** Single developer, all local, zero infrastructure

### Team Development (Future Enhancement)
```
Dev Machine 1          Dev Machine 2
  ├── Django:8000       ├── Django:8000
  └── MCP :5000         └── MCP :5000
                              │
                         Shared Config
                         (GitHub .env.example)
```

**Setup:** Each dev runs identical local setup

### Remote/Team Scenario (If Needed)
```
Shared CI/CD
  └── Django GraphQL Endpoint
       └── MCP Server (SSE transport)
            └── Claude (via gateway)
```

**Note:** Requires more infrastructure; Pattern A with local STDIO is simpler for individual dev.

---

## Success Metrics

### Phase 1 (Setup)
- [ ] Django backend running with GraphQL introspection enabled
- [ ] mcp-graphql installed and configured
- [ ] Claude Desktop/Cursor connects successfully
- [ ] Schema introspection works (< 500ms)

### Phase 2 (Basic Usage)
- [ ] Claude can fetch and display your GraphQL schema
- [ ] Claude generates valid GraphQL queries
- [ ] execute_graphql_query returns correct data
- [ ] No errors in MCP logs

### Phase 3 (Workflow)
- [ ] Claude generates usable TypeScript types from schema
- [ ] React hooks generated by Claude work in Next.js
- [ ] Query optimization suggestions are accurate
- [ ] Developers report faster iteration cycles

### Phase 4 (Advanced)
- [ ] Mutations tested and working (if enabled)
- [ ] Custom scalars and enums handled correctly
- [ ] Error messages are helpful and actionable
- [ ] Setup takes < 10 minutes for new team members

---

## Maintenance & Updates

### Regular Tasks
- **Weekly:** No action needed (stateless)
- **Monthly:** Check for mcp-graphql updates: `npm update`
- **Quarterly:** Verify Django introspection still enabled; test schema changes

### Upgrade Path
```bash
# Check for updates
npm outdated

# Update mcp-graphql
npm update mcp-graphql

# Restart MCP server
./start-mcp-graphql.sh
```

### Monitoring (Logs)
```bash
# MCP logs appear in Claude/Cursor logs
# Manually test:
ENDPOINT=http://localhost:8000/graphql npx mcp-graphql

# Debug mode (if available):
DEBUG=mcp-graphql:* npx mcp-graphql
```

---

## Appendix: File Templates

### .gitignore Entry
```
# MCP Server
mcp-server/.env
mcp-server/.env.local
mcp-server/node_modules/
mcp-server/.DS_Store
```

### README for mcp-server/ Directory

```markdown
# Django GraphQL MCP Server

Exposes your Django GraphQL backend to Claude/Cursor for AI-assisted code generation.

## Quick Start

1. **Setup** (first time only):
   ```bash
   npm install
   cp .env.example .env
   ```

2. **Configure** (.env):
   ```bash
   ENDPOINT=http://localhost:8000/graphql
   ALLOW_MUTATIONS=false
   ```

3. **Run**:
   ```bash
   ./start-mcp-graphql.sh
   ```

4. **Connect**: In Claude Desktop/Cursor MCP settings, add:
   ```json
   {
     "command": "bash",
     "args": ["/path/to/this/directory/start-mcp-graphql.sh"]
   }
   ```

## Usage

In Claude: "Introspect my GraphQL schema, then generate a React hook to fetch users."

Claude will use the MCP tools to:
1. Fetch your live schema
2. Generate code matching your schema
3. Test queries if needed

## Tools Provided

- `introspect_graphql_schema`: Fetch your GraphQL schema
- `execute_graphql_query`: Run queries/mutations (if ALLOW_MUTATIONS=true)

## Troubleshooting

- Django not running? Start it: `python manage.py runserver 8000`
- MCP not connecting? Restart Claude completely
- Auth issues? Check HEADERS in .env is valid JSON
```

---

## References

- mcp-graphql Documentation: https://github.com/blurrah/mcp-graphql
- Model Context Protocol: https://modelcontextprotocol.io/
- Claude Desktop MCP Setup: https://claude.ai/
- Graphene Django: https://django-graphene.readthedocs.io/
- Next.js + Apollo Client: https://www.apollographql.com/docs/react

---

## Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | _(You)_ | ✅ | Jan 26, 2026 |
| Tech Lead | _(Optional)_ | | |
| Product | _(N/A - Internal)_ | | |

---

**Document Version:** 1.0  
**Last Updated:** January 26, 2026  
**Next Review:** Upon first deployment or schema changes  
