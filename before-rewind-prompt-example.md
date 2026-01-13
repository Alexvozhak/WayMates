# Before-Rewind Prompt Example

This prompt is called at 10-15% remaining context window to preserve session context for the next session.

---

## Goals

1. Summarize the session, transfer context to the next session
2. Reflect deeply to find root causes of mistakes and my corrections during this session

---

## Workflow

### Step 1: Check session continuity

Did I already pass you a session document in this chat?
- **Yes** → Update the existing document
- **No** → Create a new markdown file in `sessions/`

### Step 2: Write session summary

Record the following (no duplicates, phase by phase):

- **Done:** Brief summary, key outcomes (no code walls)
- **TODO:** What remains to be done
  - **IMPORTANT:** Re-read the dialog — all mentioned TODOs (tests, data imports, refactoring) must be in the list
- **Useful links/artifacts:** If there was research

### Step 3: Reflect and update knowledge base

Only AFTER the session file is complete — reflect.

If there's something valuable (don't just add fluff to please me!), make targeted updates:

| Document | What to add | What NOT to add |
|----------|-------------|-----------------|
| **guidelines.md** | Anti-patterns, LLM mistakes, behavior rules, work patterns | Business logic, architecture, code |
| **business-logic.md** | Business entities (WHAT and WHY), User Journey, UX requirements | TypeScript types, files, architecture |
| **knowledge-base.md** | Architecture (HOW and WHERE), files, flow diagrams, tech rules | Business meaning, duplicates, long code |

**Rules:**
1. Read files **completely** before editing
2. **Check for duplicates** — add links instead of copying
3. **Code snippets** — only valuable ✅/❌ examples (1-2 lines max)
4. **On conflict** — ask the user, don't overwrite silently
5. Propose edits **point by point**
6. Edits must be targeted, match the document style

### Step 4: Generate resume prompt

After everything is done, provide a short prompt to paste when I do rewind. This prompt should quickly restore context from the session document.

---

## Why this works

- **Controlled context transfer** — you decide what's important, not autocompact
- **Knowledge accumulation** — insights go to permanent docs, not lost in chat
- **Reproducible sessions** — resume prompt gets you back to "supergenius" state fast
