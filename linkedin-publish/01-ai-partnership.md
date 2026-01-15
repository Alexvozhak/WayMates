# How to Train Your AI Dragon and Ship Like a Team

A story about taming an AI assistant and turning it into a real development partner.

## Prologue: Challenge Accepted

Five months ago, I started building WayMates — a career transition analysis platform. Solo. No team, no funding, limited runway.

I knew I couldn't write that much code myself in time. I'd love to have a team of developers — but where would I get one? So I took on a challenge: could I build an entire product using only AI?

14 hours a day, 7 days a week. Spoiler: it worked. But the path was nothing like I expected.

## Chapter 1: Why Everyone Gets Disappointed

Most developers I know have already "tried AI." Some played with ChatGPT — no project context, just Q&A. Others tried free models in Cursor.

Their conclusions were pretty much the same: "Meh. Easier to write it myself."

I started the same way. And reached the same conclusions.

**Training Wheels Uphill**

My first mistake — penny wise, pound foolish. I hoped to build the entire project for $20 on Cursor's auto mode.

The feeling was like being an adult trying to ride a kid's tricycle uphill. When it would be faster to just walk. You pedal, you sweat — minimal output.

Cursor's auto mode with free models was simply awful. It killed any desire to use AI in my work. The LLM wasn't confident in its answers, flip-flopped constantly, couldn't hold a coherent conversation about the project.

**Tip #1: Don't Cheap Out on the Model**

This is like the "iPhone vs Android" debates — where people compare a $1,000 phone to a $200 Android device. Don't waste time on free models.

I switched to pay-per-token: Sonnet 4, GPT-4o. Roughly $10-15 per million tokens. Each session burns about 200k tokens, five sessions take two hours. Working 14-hour days — that's around 7 million tokens, roughly $100 per day.

That's when I learned two things:
- Sonnet suited me best — speed, reasoning, quality
- I wanted fixed costs, not paying for every token

So I switched to Claude Code. No regrets.

## Chapter 2: A Beast Without a Leash

Claude Code is a beast. Like a Dodge Charger: 600 horsepower on rear-wheel drive. Just hit the gas — and you're already sideways. The power is there, but without knowing how to handle it — you'll wreck everything.

Remember the scene from "How to Train Your Dragon" when Hiccup first meets Toothless? That was pretty much my experience. Wild, untamed power. We don't understand each other. I can't find the right approach.

**Attempt #1: Sub-agents**

First idea: create multiple sub-agents. Each with an abstract prompt: "do your job as a tester well," "be a good architect," "think like a business person."

Result? Chaos. Code quality was atrocious. Abstract instructions like "do well" mean nothing to an LLM.

This failure taught me the key lesson: you need to move away from abstract criteria. "Good," "quality," "readable" — empty words for a machine. You need specific, measurable constraints.

## Chapter 3: Tie Its Hands to Free Yourself

**The Problem: My Code Review Bandwidth is Limited**

3-4 parallel Claude Code sessions generate code tens of times faster than I can properly review it. I'm the bottleneck.

Goal: make the LLM write code in my style, at my quality level. So code arrives for review as ready as possible.

Prompts didn't help. Only automated enforcement worked.

**Solution: Strict Linting**

I built a strict ESLint config with hard limits:
- Maximum 2 levels of nesting
- Cyclomatic complexity under 8
- Functions under 60 lines
- No type bypasses

If Claude writes complex code — the linter blocks the commit. Automatically.

I added tools for detecting dead code and duplication. Plus pre-commit hooks that catch problems immediately.

**Key insight:** Claude likes to "forget" it broke something. "I didn't break it, it was already broken." Pre-commit hooks are salvation. They catch problems immediately, not after 10-20 commits when you can't prove who's at fault.

## Chapter 4: How I Discovered the Three 90% Rule

**The Story of One Screw-up**

Claude confidently takes on a task. I step away for 15 minutes. I return — 300 lines of code that compile but do something completely wrong.

I ask: "You said you were confident?"

"Yes, 95%."

Turns out: he was confident in syntax and architecture. But he had no idea WHY we were doing this task. He had business questions he never asked. Just blindly executed the plan.

**Three Readiness Criteria**

That's how I arrived at the formula. Three criteria, each must be at 90%+:

**1. Knowledge of the codebase and architecture**
Does it understand the project structure? Know where things are? See the patterns already in use?

**2. Knowledge of business logic**
Does it understand what the product should do? What use cases? What constraints?

**3. Understanding of the specific task's purpose**
Does it understand WHY we're doing this task? What problem we're solving?

If any criterion is below 90% — we don't start. Let it read code, documentation, ask questions. But don't write code blindly.

## Chapter 5: Accept-on-Edit — Another Trap

Let's say all three criteria are at 90%+. Claude understands everything. The plan is solid. Can you turn on auto-accept and walk away?

No.

**I never regretted staying to watch** the implementation of a "fully planned" task. Every time there was a stumbling block that needed on-the-fly correction.

**I always regretted when I didn't watch.** Then I had to sift through a wall of code, trying to figure out where Claude went off track.

Another insight: even when the LLM says it completed everything according to plan — don't take its word for it. Ask it to review the diff. 9 out of 10 times you'll find something forgotten or quietly postponed.

## Chapter 6: Autocompact — A Trap

I believed in autocompact for a long time — that it would carry over context to the next session. But no.

Claude Code is "50 First Dates." Every session starts with a blank slate. Autocompact loses nuances, oversimplifies, forgets important things.

**Tip:** Disabling autocompact unlocks an extra ~30k tokens. To track remaining context, use this status line script: https://github.com/sirmalloc/ccstatusline

Now you see exactly when it's time to wrap up the session.

**Solution: Manual Context Management**

I created a special end-of-session routine that:
1. Conducts reflection: what we did, what's left, what insights
2. Records context in three documents: Guidelines, Business Logic, Knowledge Base

These same documents load at the start of the next session. Manual controlled compaction.

Why not automated memory tools? Tried them — black box. Unclear what got saved. The manual approach requires more effort but gives full control.

## Chapter 7: Power User Techniques

**Rewind — The Main Secret**

Rewind lets you roll back a session to a specific message WITHOUT rolling back file changes.

This changes everything.

**Scenario: Deep Context Mode x10**

I have a plan with 10 items. All require the same loaded context.

What I do:
1. Complete item 1
2. Ask for a brief report
3. Save the report
4. Roll back the session to before item 1
5. Paste the report about completed item 1
6. Say: "Now item 2"
7. Repeat

This way I completed 10-15 tasks per session. Context preserved, tokens not wasted on reloading.

**Sub-agents — When to Use**

Good for research tasks where they don't need your session context. Bad for code review or planning — you need real-time control there.

**Git Worktree for Parallel Sessions**

Must-have for parallel work. Each Claude Code session works in its own worktree — full file isolation.

## Chapter 8: Prompt Principles

Key phrases that change behavior:

**"Follow SRP"** — each method/class has its own strict responsibility zone.

**"Don't try to please me"** — admit uncertainty, don't make assumptions, ask questions.

**"Write consistent code"** — look around first, follow existing patterns.

**"Follow the Pareto principle"** — 20% of effort yields 80% of results. No overengineering.

**"Don't reinvent the wheel"**

Story: I needed a batching feature. Claude wrote 100 lines. After research — found a library, reduced to 50 lines. Second research — found a better library, fit in 15 lines.

**"Fail fast, not defensive coding"**

Anti-pattern: instead of throwing an error on bad input, Claude suggested weakening types, making fields optional, letting ambiguity seep deep into the code.

Rule: handle invariants at the boundary. Fail fast.

**Learning New Tools**

If you need to work with a specific library:
1. State the business problem
2. Research documentation
3. Make a simple proof of concept first
4. Save learnings to a document
5. Attach this document at the start of each session

Big mistake — jumping straight into business code. First train on POC.

## Epilogue: Come with Solutions, Not Problems

The main rule I derived:

**Come with solutions, not problems.**

Evaluate each solution by:
- Honesty (to users)
- Implementation simplicity
- Architectural cleanliness
- Pareto efficiency
- Best practices alignment

Provide a recommendation, alternatives, comparison, arguments. And confidence percentage.

## Summary

5 months with Claude Code taught me: without a working system, AI is technology in the hands of a savage. Power exists, results don't.

**Key takeaways:**
- Don't cheap out on the model — training wheels won't get you uphill
- Three 90%+ criteria — code, business logic, task purpose
- Don't rely on autocompact — manual context control
- Don't walk away from auto-accept — regretted every time
- Discipline infrastructure — strict linting, pre-commit hooks
- Rewind — the power user's main superpower

With this system, one developer can do the work of a small team. I tested it.

**Useful Resources:**
- Status line script for token tracking: https://github.com/sirmalloc/ccstatusline
- Large prompt library for AI development: https://www.aitmpl.com/

---

**Article series about WayMates:**

1. **AI Partnership** (this article) — how I work with Claude Code
2. **Business Story** — why I built WayMates and for whom → [LINK]
3. **Technical Architecture** — how it's built under the hood → [LINK]

---

What's your experience with AI-assisted development? Have you found similar patterns?
