# FEAT-055: Demo Video for Pre-Seed

**Date:** 2025-12-30
**Status:** PENDING
**Priority:** 🔴 P0
**Component:** Marketing, Data, Testing

---

## Motivation

Pre-seed demo videos showcase WayMates value proposition. Solve the "chicken-and-egg" problem — demonstrate the product without requiring registration.

**Business Value Demonstrated:**

| Search Type | What We Find | User Value |
|-------------|--------------|------------|
| **Pathfinder** | Was like me → Reached my goal | "Proof of transition — this path is possible" |
| **Waymate** | Similar to me + same goal | "Peers for networking, people in same situation" |
| **ReversePathfinder** | Reached goal (any start) | "Goal validation — where do people come from to reach this position" |

---

## Context: DTW (Dynamic Time Warping)

### Three Metrics (each 0-1, total max = 3.0)

| Metric | Formula | What It Measures | Business Interpretation |
|--------|---------|------------------|------------------------|
| **Shape** | `1 / (1 + distance / pathLength)` | Similarity of contexts at each step | "Did they pass SAME positions/domains/roles" |
| **Tempo** | `1 / (1 + derivDistance / pathLength)` | Career growth speed | "Grew at SAME speed (years per position)" |
| **Alignment** | `minLength / actualPathLength` | How much "warping" needed | "Same number of stages or more/less" |

### Step Distance (7 aspects, equal weights)

```
distance = avg(position, duration, domains, industry, country, citizenships, role)
```

- Binary: 0 if matches, 1 if different
- Jaccard: for sets (domains, citizenships)
- Normalized: for duration `|a-b| / max(a,b)`

### DTW Total Score Interpretation

| Score | Meaning |
|-------|---------|
| > 2.5 | Very similar trajectories — highly relevant |
| 2.0-2.5 | Similar — worth considering |
| 1.5-2.0 | Moderate similarity — some differences |
| < 1.5 | Different trajectories — less relevant |

---

## Demo User: Alex Komarov

**NOT a fixture** — trajectory comes from adhoc input or CV upload dynamically.

**Source files:**
- CV markdown: `/home/alex/projects/WayMatesRemote/KomarovAlex2025.md`
- CV PDF: `/home/alex/projects/WayMatesRemote/Profile.pdf`

### Trajectory (from CV)

| # | Period | Company | Position | Domain | Key Skills |
|---|--------|---------|----------|--------|------------|
| 1 | 2016-2023 (7y) | Research Institute | middle | backend, mobile | c++, python |
| 2 | 2023 May-Sep (5m) | DSSL | middle | backend, security | c++, postgresql |
| 3 | 2023 Sep - 2025 Apr (1.5y) | DSSL | team_lead | backend | typescript, nestjs, postgresql |
| 4 | 2025 Apr - now | Lido | senior | backend, platform | typescript, python, go, docker |

### Goal

- **Country:** NL (Netherlands)
- **Salary:** 200k EUR
- **Position:** cto or head_of_engineering
- **Domain:** ai, platform
- **Industry:** technology
- **Role:** developer or architect

---

## Two Videos

### Video 1: Quick Search (3 min)

**Focus:** Fast entry, value in 3 minutes
**Mode:** Adhoc (no DTW)

```
User: /start

Bot: [greeting, explains two modes]

User: Hi! I'm a senior backend developer, TypeScript, Python,
      8 years experience, currently in web3, based in Russia

Bot: [confirms context, offers explore or goal]

User: Show me similar people

Bot: [shows candidates + Chart]

User: Interesting! I'm thinking about transitioning to founder engineer role in NL

Bot: [extracts goal, shows understanding]

User: Yes, correct. Are there people who made this transition?

Bot: [shows pathfinders — people who transitioned from backend to founder]
     [Chart with goal line]

User: Cool! What skills did they all need for this transition?

Bot: [Advisor analyzes trajectories and gives recommendations with warnings]
```

### Video 2: Cold Start + CV + DTW (5 min)

**Focus:** DTW Spider Chart — main wow effect
**Mode:** Profile (with DTW)

```
User: [sends CV as text or PDF]

Bot: 📄 Processing your CV...

Bot: Here's what I understood:

📋 4 contexts:
1. Software Engineer @ Research Institute (2016-2023)
   C++, Embedded, Qt, STM32, UAV
2. Middle Developer @ DSSL (2023)
   C++, Security systems
3. Team Lead @ DSSL (2023-2025)
   TypeScript, NestJS, team of 7
4. Technical PM @ Lido (2025-now)
   TypeScript, Vyper, Python, Go, Web3

Confirm? I can clarify details.

User: Yes, but at Lido I'm more infra engineer than PM

Bot: [shows updated context]

User: Yes, now correct

Bot: ✅ Saved! 4 contexts, 9 years experience.
     Now I can find people with similar trajectory.
     Show who followed similar path?

User: Yes, show similar

Bot: [shows candidates with DTW metrics]
     [SPIDER CHART — main wow moment]

     🥇 Candidate #1: ideal match (DTW: 2.71)
     - Shape 0.91 — embedded → backend → web3 like you
     - Tempo 0.89 — same timing on positions
     - Alignment 0.91 — 4 stages like you

     🥈 Candidate #2: same path, sprinter (DTW: 1.52)
     - Shape 0.85 — same positions
     - Tempo 0.25 — in 4 years instead of 9

User: What do all people who transitioned to founder engineer have in common?

Bot: [Advisor analyzes with quotes from feedbacks, including warnings]
```

---

## Available Dictionary Terms

**Reference for fixture creation — use ONLY these values:**

### Positions (order = seniority)
`intern`, `junior`, `middle`, `senior`, `team_lead`, `tech_lead`, `engineering_manager`, `project_manager`, `product_manager`, `engineering_director`, `head_of_engineering`, `vp_of_engineering`, `cto`, `ceo`

### Roles
`developer`, `qa`, `devops`, `sysadmin`, `analyst`, `data-engineer`, `data-scientist`, `architect`, `secops`, `designer`, `dba`

### Domains
`backend`, `frontend`, `data-engineering`, `mobile`, `architecture`, `management`, `saas`, `fintech`, `ai`, `security`, `devops`, `qa`, `platform`, `ecommerce`, `edtech`, `healthtech`

### Industries
`consulting`, `defense`, `education`, `energy`, `finance`, `government`, `healthcare`, `legal`, `manufacturing`, `media`, `retail`, `technology`, `telecom`, `transportation`

### Skills (examples)
Languages: `c++`, `python`, `javascript`, `typescript`, `java`, `go`, `rust`, `kotlin`, `swift`
Frameworks: `react`, `vue`, `angular`, `django`, `flask`, `fastapi`, `nestjs`, `spring`
Data: `postgresql`, `mysql`, `mongodb`, `redis`, `elasticsearch`, `kafka`
Infra: `docker`, `kubernetes`, `aws`, `gcp`, `azure`, `terraform`, `ansible`
ML: `tensorflow`, `pytorch`, `scikit-learn`, `pandas`, `numpy`, `spark`
Monitoring: `prometheus`, `grafana`, `datadog`

### Creation Reasons
`started_working`, `position_changed`, `role_changed`, `company_changed`, `domain_changed`, `industry_changed`, `location_changed`, `salary_changed`, `laid_off`

---

## Fixtures: 10 Users

**Requirements:**
- Each context MUST have `feedback` (max 200 chars) — career transition insight
- Each user MUST have 1-2 trails per context with `userFeedback` — course review
- All terms from dictionaries above

### 4 Pathfinders (reached Alex's goal FROM similar context)

**Goal reached:** NL, head_of_engineering/cto, ai/platform, technology

| # | Name | Shape | Tempo | Align | Trajectory Summary |
|---|------|-------|-------|-------|-------------------|
| 1 | **IdealPathfinder** | ~0.9 | ~0.9 | ~0.9 | middle(7y)→team_lead(2y)→head_of_engineering(NL) — 4 contexts like Alex |
| 2 | **SprintPathfinder** | ~0.85 | ~0.25 | ~0.5 | Same positions in 4 years — 5 contexts, fast growth |
| 3 | **AltRoutePathfinder** | ~0.3 | ~0.85 | ~0.5 | frontend→fullstack→architect→cto — different domains, same tempo |
| 4 | **DirectPathfinder** | ~0.4 | ~0.3 | ~0.9 | data-scientist→analyst→product_manager→cto — different path, 4 contexts |

**Detailed feedbacks (on contexts):**

| User | Context | Feedback (example) |
|------|---------|-------------------|
| IdealPathfinder | ctx1 (middle) | "7 years at one company taught patience. Warning: comfortable salary is a trap — I stayed 2 years too long." |
| IdealPathfinder | ctx2 (team_lead) | "Leading a team of 5 was harder than coding. Key: delegate early, don't be a bottleneck." |
| IdealPathfinder | ctx3 (senior, NL) | "Relocation took 4 months paperwork. 30% ruling is real — saves 10k/year in taxes." |
| IdealPathfinder | ctx4 (head_of_engineering) | "CTO role is 80% people, 20% tech. If you hate 1:1s, stay IC. Warning: burnout is real at this level." |
| SprintPathfinder | ctx1 | "Startup chaos accelerates growth but destroys work-life balance. Burned out at 25." |
| SprintPathfinder | ctx2 | "Each company change = 30% salary bump. Loyalty doesn't pay in tech." |
| AltRoutePathfinder | ctx1 | "Frontend taught me user empathy. Backend devs often forget who uses their APIs." |
| AltRoutePathfinder | ctx2 | "Architecture role opened doors to leadership. Technical depth matters less than communication." |
| DirectPathfinder | ctx1 | "Data science is oversaturated. Pivot to engineering or management — more opportunities." |
| DirectPathfinder | ctx2 | "Product manager detour gave business context. Now I speak both languages fluently." |

### 4 Waymates (same goal, NOT reached yet)

**Goal:** NL, head_of_engineering/cto, ai/platform, technology — still in progress

| # | Name | Shape | Tempo | Align | Trajectory Summary |
|---|------|-------|-------|-------|-------------------|
| 1 | **IdealWaymate** | ~0.9 | ~0.9 | ~0.9 | Similar to Alex — middle→team_lead→senior, targeting NL |
| 2 | **SprintWaymate** | ~0.85 | ~0.25 | ~0.5 | Fast growth — junior→senior in 3 years, 5 contexts |
| 3 | **AltWaymate** | ~0.3 | ~0.85 | ~0.5 | data-scientist→data-engineer→architect — same tempo, different domains |
| 4 | **DirectWaymate** | ~0.4 | ~0.3 | ~0.9 | devops→sysadmin→architect — different path, 4 contexts |

**Detailed feedbacks:**

| User | Context | Feedback (example) |
|------|---------|-------------------|
| IdealWaymate | current | "Applied to 50+ NL companies — 3 interviews. Dutch market is competitive. Building side projects to stand out." |
| SprintWaymate | current | "After 3 startups, skills are table stakes. Now focusing on leadership visibility." |
| AltWaymate | current | "ML models without infra = science project. Learning kubernetes to become full-stack ML engineer." |
| DirectWaymate | current | "Blue Card process started. Warning: 30% ruling requires 150km border residence history. Check eligibility first." |

### 2 ReversePathfinders (reached goal from DIFFERENT trajectories)

**Reached:** NL, cto/head_of_engineering — from non-Alex-like backgrounds

| # | Name | Trajectory | Feedback |
|---|------|-----------|----------|
| 1 | **PMToFounder** | analyst→product_manager→engineering_director→cto | "CTO is 80% product decisions, 20% code. Warning: 4 hours daily in stakeholder calls. If you hate meetings, stay IC." |
| 2 | **DSToFounder** | data-scientist→data-engineer→architect→head_of_engineering | "Kaggle medals don't deploy. AI startup leaders care about infra costs more than model accuracy. Learn terraform." |

### Trails Requirements

Each user needs 1-2 trails per context transition:

| Trail | skill | platform | userFeedback (example) |
|-------|-------|----------|----------------------|
| before ctx1 | python | coursera | "Great foundation course. Warning: real job needs 10x more than any course teaches." |
| ctx1→ctx2 | kubernetes | udemy | "Practical focus, but outdated. Check course date before buying — k8s changes fast." |
| ctx2→ctx3 | typescript | youtube | "Free and excellent. Downside: no structure, need self-discipline." |
| ctx3→ctx4 | terraform | pluralsight | "Enterprise quality but expensive. Wait for sales — 50% off happens quarterly." |

---

## Implementation Plan

### Phase 1: Create Fixtures

1. **Create JSON fixture file:** `tests/core/fixtures/demo-users.json`
2. **Structure:** 10 users with contexts, trails, feedbacks
3. **Goal for pathfinders:** NL, head_of_engineering/cto, ai/platform
4. **Validate with Zod:** Run fixtures through schema before loading

```typescript
// Validation script: scripts/validate-demo-fixtures.ts
import { userContextSchema, trailSchema } from '../src/shared/schemas.js';
import demoUsers from '../tests/core/fixtures/demo-users.json';

for (const user of demoUsers) {
  for (const ctx of user.contexts) {
    userContextSchema.parse(ctx); // throws on invalid
  }
  for (const trail of user.trails) {
    trailSchema.parse(trail);
  }
}
console.log('✅ All fixtures valid');
```

### Phase 2: Unit Tests (DTW Verification)

```typescript
// tests/core/unit/dtw-demo-fixtures.unit.ts
// Run fixtures through TrajectorySimilarityService
// Verify metrics give required contrast
```

**Expected results:**
- IdealPathfinder: Shape ~0.9, Tempo ~0.9, Align ~0.9
- SprintPathfinder: Shape ~0.85, Tempo ~0.25, Align ~0.5
- AltRoutePathfinder: Shape ~0.3, Tempo ~0.85, Align ~0.5
- DirectPathfinder: Shape ~0.4, Tempo ~0.3, Align ~0.9

### Phase 3: Batch Tests

**Adhoc flow (Video 1):**
```yaml
# tests/e2e/batches/demo-adhoc.yaml
name: demo-adhoc
locale: en
steps:
  - message: "I'm a senior backend developer, TypeScript, Python, 8 years, web3, Russia"
    expect:
      phase: confirming_adhoc_context
  - message: "Show me similar people"
    expect:
      phase: showing_exploration_candidates
  - message: "I want to become founder engineer in Netherlands"
    expect:
      phase: showing_goal
  - message: "Yes, show who made this transition"
    expect:
      phase: asking_after_validate_candidates
```

**Cold-start flow (Video 2):**
```yaml
# tests/e2e/batches/demo-cold-start.yaml
name: demo-cold-start
locale: en
steps:
  - message: |
      Here's my CV:
      [contents of KomarovAlex2025.md]
    expect:
      phase: awaiting_plan_confirmation
  - message: "Yes, but at Lido I'm infra engineer not PM"
    expect:
      phase: awaiting_context_confirmation
  # ...
```

### Phase 4: Integration Test (CV Parsing)

```typescript
// tests/facade/agents/cold-start-v2/integration/cv-demo.integration.ts
// Verify cold-start correctly parses CV into 4 contexts
// Verify contexts have correct fields
```

### Phase 5: grammY E2E Tests (Video Recording)

**Final step before recording.** Real Telegram tests with PDF attachment.

**Source files:**
- PDF: `/home/alex/projects/WayMatesRemote/Profile.pdf`
- MD (for batch): `/home/alex/projects/WayMatesRemote/KomarovAlex2025.md`

**Test structure:**
```typescript
// tests/telegram-bot/e2e/demo-video-1.e2e.ts
// Adhoc flow — text only, no PDF

// tests/telegram-bot/e2e/demo-video-2.e2e.ts
// Cold-start flow — sends Profile.pdf via Telegram API
// Uses GramJS or grammY test utilities to:
// 1. Send PDF as document
// 2. Verify bot parses 4 contexts
// 3. Complete cold-start flow
// 4. Search with DTW
// 5. Ask Advisor questions
```

**Why grammY tests for video:**
- Real Telegram UI visible in recording
- PDF attachment shows actual upload UX
- Bot responses appear naturally with typing indicators
- Can screen-record the entire flow

---

## Files to Read Before Implementation

### Code (DTW & Search)

| File | Purpose |
|------|---------|
| `src/core/trajectory-similarity.service.ts` | DTW formulas and computation |
| `src/core/search-manager.ts` | How DTW is used in search |
| `src/config/scoring.ts` | DTW_MIN_TRAJECTORY_LENGTH constant |
| `src/shared/schemas.ts` | UserContext, DTWMetrics, feedback field |

### Code (Cold-Start)

| File | Purpose |
|------|---------|
| `src/facade/langGraph/cold-start-v2/prompts.ts` | Extraction prompts |
| `src/facade/langGraph/cold-start-v2/state.ts` | Phases, intents |
| `src/telegram-bot/handlers/document.ts` | PDF upload flow |

### Code (Advisor)

| File | Purpose |
|------|---------|
| `src/facade/langGraph/search-graph/prompts/advisor.ts` | Advisor system prompt |
| `src/facade/langGraph/search-graph/advisor-context-builder.ts` | How data is passed to advisor |

### Dictionaries (MUST use these terms)

| File | Purpose |
|------|---------|
| `database/positions.json` | Canonical position names |
| `database/roles.json` | Canonical role names |
| `database/domains.json` | Canonical domain names |
| `database/industries.json` | Canonical industry names |
| `database/skills.yaml` | Canonical skill names with complexity |
| `database/reasons.json` | Canonical creationReason values |

### Fixtures & Demo Data

| File | Purpose |
|------|---------|
| `tests/core/fixtures/U*.json` | Existing fixture format reference (see U8, U12 for feedbacks) |
| `KomarovAlex2025.md` | Alex's CV markdown (for batch tests) |
| `Profile.pdf` | Alex's CV PDF (for grammY e2e tests) |

### Telegram Bot (grammY E2E)

| File | Purpose |
|------|---------|
| `src/telegram-bot/handlers/document.ts` | PDF upload handler |
| `src/telegram-bot/services/mcp-client.ts` | MCP client for tool calls |
| `tests/telegram-bot/` | Existing test patterns reference |

### Documentation

| File | Purpose |
|------|---------|
| `mvp-test-final/BUSINESS-LOGIC-MVP.md` | Business logic, search modes, DTW interpretation |
| `mvp-test-final/KNOWLEDGE-BASE.md` | Architecture, phases, flows |

---

## Acceptance Criteria

### Phase 1-4: Preparation
- [ ] 10 demo fixtures created (JSON)
- [ ] Unit test verifies DTW metrics give required contrast
- [ ] Batch test adhoc flow passes (mcp-chat.ts)
- [ ] Batch test cold-start flow passes (CV markdown → 4 contexts)
- [ ] Integration test CV parsing passes

### Phase 5: grammY E2E
- [ ] grammY e2e test Video 1 (adhoc) passes
- [ ] grammY e2e test Video 2 (PDF upload + DTW) passes
- [ ] Advisor quotes feedbacks with warnings in responses

### Video Recording
- [ ] Video 1 recorded via Telegram (≤3.5 min)
- [ ] Video 2 recorded via Telegram with PDF attachment (≤5.5 min)
- [ ] Spider Chart shows wow-effect in Video 2

---

## Risks

1. **LLM unpredictable** — need multiple takes
2. **DTW metrics don't match expected** — iterate on fixture data
3. **Chart doesn't render** — verify Puppeteer before recording
4. **Cold-start mis-parses CV** — test with exact CV text first

---

## Technical Notes

### Generating Trajectories with Target DTW

**To achieve high Shape (~0.9):**
- Same positions: junior→middle→senior or similar
- Same domains: embedded→backend→web3
- Same role: developer throughout
- Same country/industry

**To achieve low Shape (~0.3):**
- Different positions sequence
- Different domains (frontend instead of backend)
- Different roles

**To achieve high Tempo (~0.9):**
- Same durations: 7y, 2y, 1y per context
- Same derivatives (rate of change)

**To achieve low Tempo (~0.25):**
- Very different durations: 2y, 1y, 1y vs 7y, 2y, 1y
- Fast growth vs slow growth

**To achieve high Alignment (~0.9):**
- Same number of contexts (4)
- Clean 1:1 mapping possible

**To achieve low Alignment (~0.5):**
- Different number of contexts (6 vs 4)
- Requires "warping" to align
