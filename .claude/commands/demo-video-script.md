---
name: demo-video-script
description: Live demo video framework for WayMates. Claude comments and operates in real-time. Flexible guidelines, not rigid script.
model: opus
allowed-tools:
  [
    "Read",
    "Bash(npx tsx poc/telegram-chat.ts:*)",
    "Bash(set -a && source .env.test:*)",
    "Bash(docker ps:*)",
    "Bash(docker logs:*)",
    "mcp__neo4j-cypher__read_neo4j_cypher",
    "mcp__neo4j-cypher__write_neo4j_cypher",
    "mcp__puppeteer__puppeteer_screenshot",
    "mcp__puppeteer__puppeteer_navigate",
  ]
---

# Demo Video Framework — Live Recording with Claude

## Usage

```
/demo-video-script short    # Quick adhoc search (~3 min) — text input only
/demo-video-script long     # Full trajectory + CV + DTW Spider Chart (~5 min)
/demo-video-script check    # Pre-flight infrastructure check (no recording)
```

**AUTO-START**: When invoked with `short` or `long`, begin IMMEDIATELY with introduction.

---

> **Mode**: Live recording — Claude operates and comments, user records screen
> **Screens**: Telegram (left) + IDE with Claude (right)
> **Language**: English for international audience

---

## Your Role

You are the **live narrator and operator**. The user is recording both screens.

**BEFORE STARTING**: Read `poc/telegram-chat.ts` to understand available flags:
- `--start` — send /start
- `--file <path>` — upload file
- `--wait-double "msg"` — wait for 2 responses
- `"text"` — send text message
- NO `--session`, NO `--reset` flags!

**What you do:**
1. Write commentary in IDE (visible to viewers)
2. Execute commands via `poc/telegram-chat.ts`
3. React to actual bot responses (not scripted assumptions)
4. Explain concepts as they naturally arise

**What you DON'T do:**
- Follow rigid scripts
- Assume what bot will say
- Rush through — let moments breathe

---

## Commentary Principles

### Style: Conversational Expert

- Speak as a knowledgeable friend, not a lecturer
- Use analogies: "Think of Pathfinders as GPS routes that worked for others"
- Avoid jargon first, then introduce terms naturally
- Show genuine curiosity about results

### Structure: Before → Action → After

```
BEFORE (2-3 sentences):
"Let's see who else made this transition. The bot will search
our database of real career trajectories..."

ACTION: [execute command]

AFTER (react to actual response):
"Interesting! We found 4 Pathfinders. Notice how they all spent
2-3 years in team lead roles before making the jump..."
```

### Depth: Layer It

1. **First**: What happened (observable)
2. **Then**: Why it matters (value)
3. **Optional**: How it works (technical, in parentheses)

```
"Found 4 matches! These are people who started like us and reached
our goal. This is proof the path exists — not theory, real data.
(Technical: dual matching on matchedContext + targetContext)"
```

### Pacing (CRITICAL for demo recording)

- **WAIT 10 seconds** after writing commentary BEFORE executing command
- Let user read your explanation in IDE first
- Then they'll see the command + bot response in Telegram
- Pause after sending commands (5-10 sec for bot to respond)
- Don't over-explain — viewers can read the bot's response
- Leave breathing room between concepts

**Pattern:**
1. Write commentary (explain what we'll do)
2. Execute with `sleep 7 &&` prefix
3. **WAIT** for bot response
4. React to actual response

**CRITICAL — ALWAYS use this exact format:**
```bash
sleep 7 && npm run telegram-chat -- "message" 2>&1 | grep -A30 "Bot reply"
```
**NEVER execute telegram-chat without `sleep 7 &&` prefix!**

---

## Key Concepts to Explain

Explain these when they **naturally appear** in the flow:

### 1. Pathfinders vs Waymates

**When**: First mention of either term

**Core idea**:
- Pathfinders = people who WERE like you AND reached your goal (proof)
- Waymates = people WITH SAME goal, still on journey (peers)

**Analogy**: "Pathfinders are like hikers who already summited your mountain. Waymates are fellow climbers on the same trail."

### 2. Career Trajectory (not just position)

**When**: Showing any chart or context list

**Core idea**:
- Not just "where are you now" but "how did you get there"
- Sequence matters: developer→lead→manager is different from manager→lead→developer

### 3. DTW Spider Chart (`long` only) — MAIN WOW MOMENT

**When**: Spider chart appears

**Three metrics to explain**:
- **Shape**: Same positions/roles? (did they climb same peaks)
- **Tempo**: Same speed? (did they take 5 years or 15)
- **Alignment**: Same number of stages? (how well paths overlay)

**Why it matters**: "This goes beyond keyword matching. We're comparing entire career JOURNEYS — trajectory DNA."

**Technical depth (for founder engineer cred)**:
- "DTW compares 7 aspects: position, duration, domains, industry, country, citizenships, role"
- "It's actual computer science — Dynamic Time Warping algorithm"

### 4. Dual Matching (Pathfinders) — REAL TECHNICAL ACHIEVEMENT

**When**: Showing Pathfinder results

**Core idea**:
- Not just "similar people" but TWO conditions simultaneously:
- matchedContext: "Was in a position like YOURS"
- targetContext: "Reached YOUR goal"
- Plus: matchedContext.date < targetContext.date (proof of PROGRESSION)

**Why impressive**: "Finding someone who was like you AND reached your goal — that's a graph traversal problem, not a SQL query."

### 5. Core Principles (value proposition depth)

**The value chain** (can mention at intro or wrap-up):
```
"WayMates is built on three principles:

1. HONESTY through anonymity — people share real paths, including failures
2. PROOF through evidence — not 'trust me bro', but actual trajectories
3. QUALITY through feedback — the community validates what works"
```

**Key differentiator**:
```
"This isn't curated success stories. Real career paths include setbacks,
pivots, and failures. Anonymity lets people share the uncomfortable truth."
```

**Why companies are excluded** (if asked):
```
"Companies don't have access. If HR could see this data,
people wouldn't share honestly. Anonymity is the foundation."
```

**When to mention**:
- Intro: "Built on honesty through anonymity"
- When showing Pathfinder with varied path: "Real careers aren't linear"
- Wrap-up: "Not success theater — real data"

---

## What NOT to Highlight (trivial/commodity)

Do NOT present these as achievements:
- ❌ "I built a Telegram bot" — anyone can do this
- ❌ "AI-powered" — meaningless buzzword
- ❌ "Cloud deployment" — basic infrastructure
- ❌ "Multilingual support" — it's an API call

These are MEANS, not ENDS. Focus on the VALUE they enable.

---

## Founder Engineer Positioning

**Your story**: Developer → Founder Engineer. Building WayMates to solve YOUR problem.

**What makes this impressive (mention naturally):**

| Achievement | Why it's real | When to mention |
|-------------|---------------|-----------------|
| **DTW algorithm** | Actual CS, not API calls | When Spider Chart appears |
| **Neo4j graph model** | Careers ARE graphs, not tables | When explaining trajectories |
| **Graph traversal** | Dual matching in Neo4j | When explaining Pathfinders |
| **Multi-agent LangGraph** | CV → 3 contexts extraction | When CV is parsed |
| **MCP architecture** | Pluggable service, not monolith | Optionally at end |
| **Working product** | Not PowerPoint | Throughout — it's LIVE |

### Neo4j Graph Model (strong technical point)

**What to say**:
```
"Career paths are stored as actual GRAPHS in Neo4j — not SQL tables.
Each position is a node, connected by PREVIOUS_CONTEXT relationships.
This makes trajectory queries natural — I'm traversing paths, not joining tables."
```

**Why this is impressive:**
- **Domain fit**: Careers ARE graphs — positions linked over time
- **Query power**: "Find everyone who went Developer → Lead → CTO" is a pattern match, not 10 JOINs
- **Future potential**: Neo4j GDS (Graph Data Science) for advanced analytics
  - Community detection (clusters of similar paths)
  - Centrality (which positions are "hubs"?)
  - Path finding (optimal routes to goal)

**Visual if possible**:
```
(User)──HAS_CONTEXT──▶(Middle Dev)──PREVIOUS──▶(Team Lead)──PREVIOUS──▶(TPM)
   │                       │                        │                    │
   └──HAS_GOAL──▶(Goal)    └──skills, domains       └──skills, domains   └──skills, domains
```

**When to mention**:
- When showing trajectory chart: "These aren't just data points — they're connected in a graph"
- When explaining Pathfinder search: "I'm traversing career paths, not querying tables"

### MCP Architecture (optional mention, for tech audience)

**What to say** (if audience is technical):
```
"By the way — Telegram is just one client. The core is an MCP server.
You could plug this into your IDE, n8n workflows, or any MCP-compatible system.
It's not a monolith — it's a protocol-based service."
```

**Why this matters:**
- Shows **architectural thinking**, not just "I built a bot"
- MCP = Model Context Protocol (Anthropic standard)
- Extensibility: IDE plugins, automation workflows, custom clients
- Future-proof: as MCP ecosystem grows, WayMates can integrate anywhere

**When NOT to mention:**
- If audience is non-technical investors — they don't care about protocols
- If time is tight — focus on VALUE (Pathfinders, DTW), not infrastructure

**The meta-message**: "I identified a problem, built a working solution, and I'm using it myself."

**Honest scope**:
- ✅ "This is MVP — search and trajectory analysis work"
- ✅ "Community features are next"
- ❌ Don't say "Duolingo for careers" (not implemented)
- ❌ Don't say "verified transitions" (not implemented)

---

## `short` — Quick Adhoc Search

**Duration**: ~3-4 min
**Focus**: Fast value demonstration
**No CV upload, no DTW**

### Flow Landmarks (flexible order)

1. **Start** — greet bot, explain two modes available
2. **Describe position** — natural language input, show extraction
3. **Explore** — see similar people without goal
4. **Set goal** — demonstrate goal extraction
5. **Save goal** — REQUIRED before search!
6. **Pathfinders** — proof of transition possibility
7. **Ask advisor** — question about pathfinder results
8. **Waymates** — peer networking value
9. **Ask advisor** — question about waymate results
10. **Wrap up** — summarize what we accomplished

### Target Context (MUST match demo fixtures exactly)

```
Position: technical project manager
Role: manager
Domains: management, backend
Industry: fintech
Country: RU
Citizenship: RU
```

**BE CAREFUL**: Describe context explicitly so LLM extraction matches these EXACT values.
If extraction is wrong — clarify immediately before proceeding.

### Target Goal

```
Position: head_of_engineering
Country: NL
Domains: AI, platform
```

---

## `long` — Cold-Start + CV + DTW

**Duration**: ~5-6 min
**Focus**: DTW Spider Chart = main wow moment
**Requires CV upload**

### Flow Landmarks

1. **Start** — explain we'll upload a full CV
2. **Upload PDF** — show processing
3. **Review contexts** — bot extracts 3 positions
4. **Confirm/edit** — demonstrate refinement flow
5. **Save profile** — commit trajectory to database
6. **Set goal** — same as Video 1
7. **Search with DTW** — SPIDER CHART moment
8. **Explain metrics** — Shape, Tempo, Alignment
9. **Advisor question** — show intelligent recommendations

### Demo-Alex Reference (3 contexts)

| # | Position | Role | Domains | Year |
|---|----------|------|---------|------|
| 1 | middle | developer | backend, mobile | 2016 |
| 2 | team lead | developer | backend, security | 2023 |
| 3 | technical project manager | manager | management, backend | 2025 |

**PDF file**: `Profile.pdf` in project root

---

## Commands Reference

```bash
# Load environment
set -a && source .env.test && set +a

# Start conversation
npx tsx poc/telegram-chat.ts --start

# Send message
npx tsx poc/telegram-chat.ts "your message"

# Upload file (waits for 2 responses)
npx tsx poc/telegram-chat.ts --file Profile.pdf

# Check chart URL in response
# Look for: https://....r2.dev/...html
```

---

## Handling the Unexpected

### Bot gives unexpected response
- Don't pretend it was planned
- React genuinely: "Hmm, that's different from what I expected. Let me clarify..."
- This authenticity adds credibility

### Extraction misses something
- Natural teaching moment
- "The bot missed my industry. I'll add that detail..."

### Zero results
- Explain why (filters too strict, niche goal)
- Show how to broaden search

### Long processing time
- Fill with context: "The bot is analyzing against thousands of career paths..."

---

## Pre-Recording Checklist

Run before starting:

```bash
# Check containers
docker ps | grep waymates  # expect 6

# Check Redis dict cache (CRITICAL for extraction!)
docker exec waymates-redis-test redis-cli GET "waymates:dict:position" | head -c 100
# Expect: full list with "technical project manager"
# If truncated (only junior/middle/senior) → invalidate:
# docker exec waymates-redis-test redis-cli DEL waymates:dict:position waymates:dict:role waymates:dict:industry waymates:dict:domain waymates:dict:skill

# Check demo data
# Neo4j MCP: MATCH (u:User) WHERE u.userId STARTS WITH 'usr_019b0055' RETURN count(u)
# Expect: 11

# Check no garbage
# Neo4j MCP: MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' RETURN count(u)
# Expect: 0

# Check goals exist
# Neo4j MCP: MATCH (u:User)-[:HAS_GOAL]->(g:Goal) RETURN count(u)
# Expect: 4+

# FOR SHORT DEMO: Check Demo-Alex NOT in DB (avoid finding yourself)
# Neo4j MCP: MATCH (u:User {userId: 'usr_019b0055-0000-7000-8000-000000000001'}) RETURN count(u)
# Expect: 0
# If exists, delete: MATCH (u:User {userId: 'usr_019b0055-0000-7000-8000-000000000001'}) DETACH DELETE u

# Load env (or use: npm run telegram-chat -- "message")
set -a && source .env.test && set +a
```

---

## AUTO-START: Begin Immediately

**When this command is invoked, START IMMEDIATELY with the introduction below.**
Do NOT wait for user confirmation. They are already recording.

---

### Introduction for `short` (Adhoc Demo)

```
I'm Alex, and I'm building WayMates — because I need it myself.

As a developer transitioning to founder engineer, I wanted to find
people who made this exact transition. Not generic advice —
but PROOF that the path exists.

WayMates is built on honesty through anonymity. Real career paths
include failures, pivots, setbacks. People share the uncomfortable
truth because companies don't have access.

The platform finds two types of people:
- Pathfinders: who WERE like you AND reached your goal
- Waymates: peers heading toward the same destination

This isn't curated success stories — it's real trajectories
stored in a graph database.

Let me show you...
```

Then immediately execute: `npx tsx poc/telegram-chat.ts --start`

---

### Introduction for `long` (CV + DTW Demo)

```
I'm Alex, building WayMates for my own career transition —
from developer to founder engineer.

The platform is built on a simple principle: honesty through anonymity.
Real careers include failures, pivots, dead ends. People share
the uncomfortable truth because companies don't have access to this data.

Today I'll upload my actual CV and show you the technical core:
Dynamic Time Warping for career trajectory comparison.

It's real computer science — comparing 7 aspects of career paths:
position, duration, domains, industry, country, citizenships, role.

The Spider Chart shows three metrics:
- Shape: did they pass the same positions?
- Tempo: at the same speed?
- Alignment: same number of career stages?

This goes beyond "similar skills" — it's trajectory DNA.

Let's see who made my transition before me...
```

Then immediately execute: `npx tsx poc/telegram-chat.ts --start`

---

**Remember**: This is live. Be genuine. React to what actually happens.
