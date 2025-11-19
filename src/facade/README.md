# WayMates Facade MCP Server

## Overview

The Facade MCP Server is an NLP Gateway that uses LangChain v1.0 `createAgent` API to process natural language requests and interact with the Core business logic.

## Architecture

- **LangChain v1.0**: Uses the new `createAgent` API (not deprecated `createReactAgent`)
- **Gemini 2.0 Flash**: AI model for NLP processing (requires `models/` prefix)
- **PostgreSQL**: For user sessions and LangGraph checkpointing
- **Redis**: For session cache and dictionary cache
- **MCP Tools**: Exposes functionality via Model Context Protocol

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.facade.example .env.facade
# Edit .env.facade with your actual values
```

**Important**: Get your Google API key at https://makersuite.google.com/app/apikey

### 3. Start Services

```bash
# Start PostgreSQL (production)
docker compose up postgres-prod -d

# Start Redis
docker compose up redis -d

# Start Core API (if not running)
npm run dev
```

### 4. Test the Agent

```bash
# Test the search careers agent
npx tsx src/facade/langchain/test-agent.ts
```

## Key Implementation Notes

### ⚠️ CRITICAL: Gemini Model Names

Always use the `models/` prefix for Gemini models:

```typescript
// ✅ CORRECT
model: "models/gemini-2.0-flash"

// ❌ WRONG (will cause 404 error)
model: "gemini-2.0-flash"
```

### LangChain v1.0 API

We use the new `createAgent` from the main `langchain` package:

```typescript
// ✅ CORRECT - v1.0
import { createAgent, tool } from "langchain";

// ❌ WRONG - deprecated
import { createReactAgent } from "@langchain/langgraph/prebuilt";
```

## Components

- **search-careers-agent.ts**: Main agent implementation using createAgent
- **postgres-connection.ts**: PostgreSQL connection singleton for checkpointing
- **session-middleware.ts**: Session management with Redis and thread_id support
- **test-agent.ts**: Simple test to verify agent functionality

## Next Steps

1. Complete integration with MCP server
2. Add more agents (get_story, set_goal, update_context)
3. Implement real normalization with dictionaries
4. Add comprehensive integration tests
5. Deploy to production