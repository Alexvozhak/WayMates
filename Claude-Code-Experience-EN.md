# How I Shipped a Full Product Without Writing Code Myself

*A story about taming an AI assistant and turning it into a real development partner*

---

## Prologue: Challenge Accepted

Six months ago, I started building WayMates — a career transition analysis platform. Solo. No team, no funding, limited runway.

I knew I couldn't write that much code myself in time. I'd love to have a team of developers — but where would I get one? So I took on a challenge: could I build an entire product using only AI?

14 hours a day, 7 days a week. Spoiler: it worked. But the path was nothing like I expected.

> *Next article will be about WayMates itself — architecture, tech stack, business logic. This one is about the methodology of working with AI.*

---

## Chapter 1: Why Everyone Gets Disappointed

### The Sad Conclusions of My Peers

Most developers I know have already "tried AI." Some played with ChatGPT — no project context, just Q&A. Others tried free models in Cursor.

Their conclusions were pretty much the same: "Meh. Easier to write it myself."

I started the same way. And reached the same conclusions.

### Training Wheels Uphill

My first mistake — penny wise, pound foolish. I hoped to build the entire project for $20 on Cursor's auto mode.

The feeling was like being an adult trying to ride a kid's tricycle uphill. When it would be faster to just walk. You pedal, you sweat — minimal output.

Cursor's auto mode with free models was simply awful. It killed any desire to use AI in my work. The LLM wasn't confident in its answers, flip-flopped constantly, couldn't hold a coherent conversation about the project.

Sometimes it felt easier to write it myself than to explain how to do it.

### Tip #1: Don't Cheap Out on the Model

> This is like the "iPhone vs Android" debates — where people compare a $1,000 phone to a $200 Android device. Don't waste time on free models.

I switched Cursor to manual model selection — pay per token. Sonnet 4, GPT-4o, Groq — roughly $10-15 per million tokens. Each session burns through about 200k tokens. Five sessions take about two hours. Working 14 hours a day — that's around 7 million tokens, roughly $100 per day.

That's when I learned two things:

1. Sonnet suited me best — speed, reasoning, quality
2. I wanted fixed costs, not paying for every sneeze

Plus Cursor was truncating Sonnet's context window to ~170k instead of 200k. Every token counts.

So I decided to switch to Claude Code. No regrets.

---

## Chapter 2: A Beast Without a Leash

### Dodge Charger on Rear-Wheel Drive

The first 2-3 months I alternated between Cursor's free models and paid ones via API. Then — my third month on Claude Code.

Claude Code is a beast. Like a Dodge Charger: 600 horsepower on rear-wheel drive. Just hit the gas — and you're already sideways. The power is there, but without knowing how to handle it — you'll wreck everything.

Remember the scene from "How to Train Your Dragon" when Hiccup first meets Toothless? That was pretty much my experience. In front of me — wild, untamed power. We don't understand each other. I can't find the right approach.

### Attempt #1: Sub-agents

First idea: create multiple sub-agents. Each with an abstract prompt: "do your job as a tester well," "be a good architect," "think like a business person."

Result? Chaos. Code quality was atrocious. Responses were random. Abstract instructions like "do well" mean nothing to an LLM.

This failure taught me the key lesson: you need to move away from abstract, relative criteria. "Good," "quality," "readable" — empty words for a machine. You need specific, measurable constraints.

---

## Chapter 3: Tie Its Hands to Free Yourself

### The Problem: My Code Review Bandwidth is Limited

3-4 parallel Claude Code sessions generate code tens of times faster than I can properly review it. I'm the bottleneck. However many lines I review per day — that's how many get committed.

**Goal:** make the LLM write code in my style, at my quality level. So code arrives for review as ready as possible — without the typical mistakes I notice session after session and ask to fix.

I wanted to review only business logic and taste decisions. Not waste time on syntax, formatting, basic architecture.

Prompts didn't help. Only automated "slaps on the wrist" worked.

### ESLint: Specific Constraints

I built a strict config based on:

- `typescript-eslint` (strict + stylistic)
- `eslint-plugin-unicorn` — modern patterns
- `eslint-plugin-import-x` — import order, ban `export *`

Key rules:

- `max-depth: 2` — maximum 2 levels of nesting
- `complexity: 8` — cyclomatic complexity ≤ 8
- `max-lines-per-function: 60` — functions up to 60 lines
- `no-explicit-any` — no `any`
- `consistent-type-assertions: never` — ban `as` casts, only type guards or Zod
- `explicit-function-return-type` — explicit return types

If Claude writes complex code — ESLint slaps its hands. Automatically. Sometimes it tries to sneak in `// eslint-disable` instead of fixing — but that gets caught in review too.

**Knip + eslint-plugin-sonarjs — Automated DRY**

Two tools, two types of "garbage":

- **Knip** — dead code: unused files, exports, dependencies. Things forgotten after refactoring.
- **eslint-plugin-sonarjs** — logical duplication: identical functions (even with different variable names), identical if/else branches. Things that should be abstracted.

**Husky + lint-staged**

> **Key insight:** Claude likes to lie. Or rather — it genuinely believes the code was like that before. "I didn't break it, it was already broken."
>
> It's hard to prove anything if it didn't verify at the start of the session that everything was clean. Pre-commit hooks are salvation. They catch problems immediately, not after 10-20 commits.

---

## Chapter 4: How I Accidentally Discovered the Three 90%s

### The Story of One Screw-up

Claude confidently takes on a task. I step away for 15 minutes. I return — 300 lines of code that compile but do something completely wrong.

I ask: "You said you were confident?"
— "Yes, 95%."

I start the post-mortem. Turns out: he was confident in syntax and architecture. But he had no idea WHY we were doing this task. He had half a dozen business questions he never asked. Just blindly executed the plan.

### Three Readiness Criteria

That's how I arrived at the formula. Three criteria, each must be at 90%+:

**1. Knowledge of the codebase and architecture**
Does it understand the project structure? Know where things are? See the patterns already in use?

**2. Knowledge of business logic**
Does it understand what the product should do? What use cases? What constraints?

**3. Understanding of the specific task's purpose**
Does it understand WHY we're doing this task? What problem we're solving? What changes for the user?

If any criterion is below 90% — we don't start. Let it read code, documentation, ask me questions. But don't write code blindly.

---

## Chapter 5: Accept-on-Edit — Another Trap

### Three 90%s Doesn't Mean Relax

Let's say all three criteria are at 90%+. Claude understands the code, business logic, task purpose. The plan is solid. Can you turn on accept-on-edit and walk away?

No.

### Every Time I Regretted Not Watching

> **Key insight:** Even if you spent an hour refining the plan and checked it twice — that's not a reason to give the LLM full carte blanche.

I never regretted staying to watch the implementation of a "fully planned" task. Every time there was a stumbling block that needed on-the-fly correction — pivoting or adjusting the plan.

And every time I regretted when I didn't watch. Then I had to sift through a wall of code, trying to figure out where Claude went off track.

### "Did Everything According to Plan" — Verify

Another insight: even when the LLM says it completed everything according to plan — don't take its word for it.

Ask it to re-read the plan and look at `git diff`. 9 out of 10 times you'll find something either not done (forgotten) or postponed and not mentioned.

I only turn on accept-on-edit for small, agreed-upon, simple tasks. And I still don't walk away.

---

## Chapter 6: Autocompact — A Trap

### Don't Rely on Automation

I believed in autocompact for a long time — that it would actually carry over all context to the next session with decent quality. But no.

Claude Code is "50 First Dates." Every session starts with a blank slate. Autocompact loses nuances, oversimplifies context, forgets important things.

> **Important:** Disabling autocompact unlocks an additional ~30k tokens of context. That's a critical amount. To control the remaining balance — custom status bar + before-rewind at session end. Full manual control over the window.

### Manual Controlled Compaction

I had to switch to manual management. Created a special `before-rewind` prompt that at the end of each session:

1. Conducts reflection: what we did, what's left, what insights
2. Records context in three documents:
   - **Guidelines** — error patterns, LLM behavior rules
   - **Business Logic** — business entities, User Journey, UX
   - **Knowledge Base** — architecture, files, flows

These same three documents are loaded at the start of the next session through the main prompt. Essentially — manual controlled autocompact.

### Why Not Memory MCP?

I thought about using Memory MCP or adapting cursor-memory-bank for Claude Code. Tried it — black box. Unclear what got saved, what didn't. Unclear in what format. Unclear how to edit.

The manual approach requires more effort but gives full control: I know exactly what's saved, in what format, and can edit between sessions.

---

## Chapter 7: Power User Techniques

### Rewind — The Main Secret

Rewind — the ability to roll back a session to a specific message WITHOUT rolling back file changes.

This changes everything.

**Important:** the message you want to return to must be sent when the LLM is paused. If you send a message while it's working — the checkpoint won't save. Always interrupt the process if you want the ability to return.

**Scenario 1: Deep Context Mode x10**

I have a plan with 10 items. All require the same context that's already loaded. Claude is in "deep context mode" — understands the code, business logic, task purpose.

What I do:

1. Complete item 1
2. Ask for a brief report: what was done, how, any deviations from plan
3. Save the report
4. Roll back the session to before item 1
5. Paste the report about completed item 1
6. Say: "Now item 2"
7. Repeat

This way I completed 10-15 tasks per session. Context preserved, tokens not wasted on reloading.

**Scenario 2: Branching for Clarification**

A question arises during work. I switch to exploring it right in the session. Figure it out.

Two options:

- If no artifact needed — roll back the session as if the detour never happened
- If plans changed — ask for a mini-report with adjustments, save it, roll back, continue with new understanding

**Hack: If You Missed the Window**

Session ended, didn't manage to do before-rewind?

1. `export` command saves the entire session history to a file
2. Cut out only the last messages (session tail) from the file
3. Rewind to a moment when you still had token headroom
4. Attach the tail file as context
5. Call before-rewind — it will save the results as if the session ended normally

### Sub-agents — When to Use

A file with a prompt that runs in the background and returns with conclusions.

Good for research:

- Study best practices via context7 + websearch
- Check code readiness for integration
- Study business requirements from documents

> **Limitation:** The sub-agent won't get your current session's context. It starts from scratch. Its observations may be false positives — it doesn't know what you agreed on.
>
> Use sub-agents when: (1) additional context isn't needed — pure research, or (2) context can be gathered from code and documents. And remember — you don't see its work process, only the result.

### Git Worktree — Isolating Parallel Sessions

Must-have for parallel work. Each Claude Code session works in its own worktree — full file isolation. Essentially — a folder fork. Then you merge what you need and delete the temporary forks.

### Never Use sed!

> **2 out of 3 sed calls ended in complete collapse** for me, requiring rollback of all affected files via `git checkout`.

For batch operations — only MCP filesystem. Orders of magnitude more reliable.

---

## Chapter 8: Prompt Principles

### Key Phrases That Change Behavior

**"Follow SRP"**
Each method/class/file — its own strict responsibility zone. No duplication or conflicts.

**"Don't try to please me"**
Don't hesitate to admit uncertainty. Don't make assumptions. Better to ask me, read the code, or check context7.

**"Write consistent code"**
Use grep to look around. If a pattern exists — follow it.

**"Follow the Pareto principle"**
20% of effort yields 80% of results. No overengineering.

**"KISS — don't reinvent the wheel"**

> **Story:** I needed a feature — batch N messages over M seconds. Claude wrote a custom implementation in 100 lines. Asked for research — found a library, reduced to 50 lines. On second research found promise-batcher — fit in 15 lines.

**"Only business-valuable tests"**
No fake theatrical tests. Without this requirement, it would happily verify field presence after Zod schemas, bloating tests with meaningless checks.

**"Fail fast, not defensive coding"**

> **Anti-pattern:** Instead of throwing an error immediately on receiving garbage, Claude suggested weakening typing, making all fields optional, letting ambiguity seep deep into the code. Every function starts by checking field presence. Constant stumbling over flexible types.
>
> **Rule:** Invariant handling logic — in one place. Fail fast at the boundary.

### Learning New Tools

If you need to work with a specific library (for me it was LangGraph and Neo4j/Cypher):

1. State the business problem you want to solve
2. Send to context7 for context + websearch
3. **Make a POC** — simple proof of concept, verify the syntax
4. Save everything to a document
5. Attach this document at the start of each session

Big mistake — jumping straight into writing business code. First train on POC, then production.

### Useful MCPs and Keywords

**Context7 MCP** — up-to-date library documentation. Required before using a new library. Otherwise Claude will hallucinate outdated API.

**Sequential Thinking MCP** — makes the LLM think step-by-step before answering. Reduces hallucinations, improves quality of complex decisions.

**Keywords in prompts:**

- `ultrathink` / `harder thinking` — activate extended model "reasoning." More internal deliberation before responding. Use for complex architectural decisions or debugging.

---

## Epilogue: Approach to Solutions

The main rule I derived:

> **Come with solutions, not problems.**

Evaluate each solution by:

- Honesty (to users)
- Implementation simplicity (LOC, files affected)
- Architectural cleanliness
- Rationality (Pareto principle)
- Alignment with best practices

Provide a recommendation, alternatives, comparison, arguments. And confidence percentage.

---

## Summary

6 months with Claude Code taught me the key lesson: without a working system, AI is technology in the hands of a savage. Power exists, results don't.

- **Don't cheap out on the model** — training wheels won't get you uphill
- **Three 90%+ criteria** — code, business logic, task purpose
- **Don't rely on autocompact** — manual context control
- **Don't walk away from accept-on-edit** — regretted every time
- **Discipline infrastructure** — ESLint, Husky, lint-staged
- **Rewind** — the power user's main superpower

With this system, one developer can do the work of a small team. I tested it.

---

*Next article: WayMates — career analytics architecture on Neo4j + LangGraph*

---

**Useful resources:**

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [Context7 MCP](https://github.com/upstash/context7) — library documentation
- [MCP Filesystem](https://github.com/modelcontextprotocol/servers) — batch operations instead of sed
