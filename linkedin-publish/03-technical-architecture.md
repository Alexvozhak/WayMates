# The Technical Architecture Behind My 5-Month Solo Build

I shipped ~12,000 lines of production TypeScript in 5 months. With 284 tests. Zero security vulnerabilities.

Here's the technical deep-dive.

📺 Live demo: https://youtu.be/z9M2QifhEfc
🔧 Code: https://github.com/Alexvozhak/WayMates
🏗️ Container Architecture: https://arch.waymates.duckdns.org/#/L2-Containers
🧩 AI Components: https://arch.waymates.duckdns.org/#/L3-Facade-Components
📊 The business story: [LINK]

**The Stack**

Modern, but pragmatic choices:

• KAG/GraphRAG on Neo4j - Knowledge graph + Cypher queries (not vector search)
• LangGraph 1.0 - State machines for AI agents
• MCP Protocol - Universal AI integration (FastMCP 3.25)
• Node.js 24 + ESM - Latest standards
• tRPC - End-to-end type safety
• grammY - Advanced Telegram framework

Why these matter:
• MCP connects to any AI client (Claude, Cursor, n8n)
• LangGraph handles complex conversation flows
• Neo4j perfect for relationship queries

AI Agent Workflows (LangGraph state machines):
• Cold Start: https://github.com/Alexvozhak/WayMates/blob/devel/docs/graphs/cold-start.md - Career story collection
• Search: https://github.com/Alexvozhak/WayMates/blob/devel/docs/graphs/search-graph.md - Waymates & pathfinders discovery

See the code: https://github.com/Alexvozhak/WayMates

**The Quality Enforcement**

Strict constraints make AI write senior-level code:

• Max nesting: 2 levels
• Complexity: <8 (cyclomatic)
• Functions: <60 lines
• No 'any' types
• No 'as' casts

Result: AI can't write bad code even if it tries.
ESLint config: https://github.com/Alexvozhak/WayMates/blob/devel/eslint.config.mjs

**The Testing Strategy**

284 integration tests with REAL AI calls:
• Parallel execution without races
• Real LLM responses (no mocking)
• Deterministic with controlled prompts
• Pre-commit hooks catch issues early (Husky)

CI/CD runs all tests on every push.

**The Infrastructure**

Production deployment, not localhost:

• 8 Docker containers orchestrated
• Caddy reverse proxy with auto-TLS
• VPS deployment
• GitHub Actions CI/CD
• Private submodules for core logic
• Architecture as Code (Structurizr C4)

📐 Live architecture: https://arch.waymates.duckdns.org

**The Security**

Zero tolerance for vulnerabilities:

• Semgrep static analysis: 0 critical findings
• npm audit: 0 vulnerabilities
• Git history: cleaned with BFG
• Dependencies: current via Dependabot
• Code cleanup: Knip for dead code elimination

**The AI Partnership**

Switched from Cursor ($100/day) to Claude Code ($200/month).

Key techniques:
• Strict ESLint = clean AI code
• Context management with rewind
• 3x90% readiness rule

Full methodology: [LINK to AI Partnership article]

**The Architecture Decisions**

Clean separation of concerns:
• Core (private): Business logic
• Facade: MCP server + AI agents + i18n
• Bot: Telegram client
• Chart: Visualization service

Multi-language support:
• Facade LLM auto-translates to user's Telegram locale
• Works with EN, RU, ES, DE, FR, etc
• No hardcoded strings - all dynamic

Each module independently deployable.

**The Results**

✅ Production app: https://t.me/WayMates_bot
✅ Public repo: https://github.com/Alexvozhak/WayMates
✅ Clean codebase: 0 dead code (Knip)
✅ Modern stack: Node 24, ESM, TypeScript 5

**What I Bring to Your Team**

• Speed: 5-month solo delivery
• Quality: 284 tests, 0 vulnerabilities
• Modern: MCP, LangGraph, AI-first
• Full-stack: From database to deployment

Looking for founding engineer roles where I can ship fast with high quality.

DeFi/Web3 Background: Technical PM at Lido
Contact: @AlexKomarov1993 | alexvozhak@gmail.com

---

**📚 Article series about WayMates:**

1. **AI Partnership** — how I work with Claude Code → [LINK]
2. **Business Story** — why I built WayMates and for whom → [LINK]
3. **Technical Architecture** — how it's built (this article)
