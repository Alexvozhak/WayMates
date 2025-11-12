# fix-bug

Выбрать и исправить баг из bugs-registry.md

## Workflow

**Ты - Claude Code, главная инстанция orchestrator.**

---

### 1. Показать список OPEN багов (интерактивно)

1. Прочитать `memory-bank/knowledge/bugs-registry.md`
2. Извлечь все баги со статусом **!= RESOLVED**
3. **Использовать `AskUserQuestion` tool** для интерактивного выбора:

```typescript
AskUserQuestion({
  questions: [{
    question: "Which bug do you want to fix?",
    header: "Select bug",
    multiSelect: false,
    options: [
      {
        label: "#2 | DTW metrics | P0 🔴",
        description: "4 sub-issues: stabilityScore low (2.1), shapeSimilarity too high (2.2), durationCap ignored (2.3), excludedCreationReasons filter not applied (2.4)"
      },
      {
        label: "#3 | Skills penalty | P0 🔴",
        description: "Skills penalty calculation incorrect when skillNames is empty array. Expected: penalty=0, Actual: penalty=null"
      },
      {
        label: "#5 | Null pointer | P1 🟡",
        description: "path-collector.ts throws null pointer exception when trajectory has no PREVIOUS_CONTEXT relationships"
      }
    ]
  }]
})
```

**Format для options:**
- **label**: `#ID | component-short | Priority emoji` (макс 50 chars для читаемости)
- **description**: Полное описание проблемы (может быть многострочное для комплексных багов)

---

### 2. Загрузить контекст по выбранному багу

После выбора пользователем номера:

1. **Прочитать полную запись бага** из registry:
   - ID, Date, Component, Description, Status, Priority
   - Acceptance Criteria (если есть)

2. **Загрузить связанный контекст** (на твоё усмотрение):
   - 📄 **Affected files** - компоненты упомянутые в баге
   - 🧪 **Related tests** - integration tests для компонента
   - 📜 **Git history** - последние изменения affected files
   - 🧠 **Memory Bank** - decisions.md, reflections с упоминанием компонента
   - 🗄️ **Schema context** - если баг связан с Cypher/Neo4j

3. **Сообщить пользователю**:
   ```
   📋 Bug #3 loaded: Skills penalty calculation incorrect

   📂 Context loaded:
   - src/core/search-query-builder.ts (current implementation)
   - tests/integration/search-manager/skills-excluded.integration.ts
   - memory-bank/decisions/creative-20250110-skills-scoring.md

   🔍 Quick analysis:
   [твой анализ проблемы]

   Ready to fix. Should I proceed or do you want to give specific instructions?
   ```

---

### 3. Исправить баг

- Пользователь может дать дополнительные инструкции или попросить сразу фиксить
- Ты исправляешь баг, следуя **стандартному workflow**:
  - ✅ Call `planner` если нужно (сложные архитектурные изменения)
  - ✅ Call `cypher-expert` если баг в Cypher queries
  - ✅ Implement fix
  - ✅ Call `reviewer` **(обязательно!)**
  - ✅ Call `qa` **(обязательно!)**

---

### 4. После фикса (автоматически)

**Выполни автоматически без запроса пользователя:**

#### 4.1. Update bugs-registry.md

```markdown
| #3 | 2025-11-11 | search-query-builder | Skills penalty when excluded | RESOLVED | 🔴 P0 | [a3f2b1c](commit-url) |
```

- Изменить статус на `RESOLVED`
- Если был git commit, добавить ссылку в колонку "Commit"

#### 4.2. Run quality checks

```bash
npm run lint
npx tsc --noEmit
npm run test:integration  # если применимо к изменённым компонентам
```

#### 4.3. Report results

```
✅ Bug #3 fixed and marked as RESOLVED!

📝 Changes:
- Updated coalesce logic in search-query-builder.ts:142
- Added test case for empty skillNames array
- All integration tests pass (12/12)

✅ Quality checks:
- npm run lint: PASSED ✓
- tsc --noEmit: PASSED ✓
- integration tests: PASSED ✓ (12/12)

✅ Updated bugs-registry.md:
- Status: OPEN → RESOLVED
- Linked commit: a3f2b1c

You can run /sync-memory at end of session to archive this bug.
```

---

## Example Session

```
User: /fix-bug

Assistant: Reading bugs-registry.md...

[Uses AskUserQuestion tool with interactive bug selection - creates tabs in UI]

User selects: "#3 | Skills penalty | P0 🔴"

Assistant: Loading context for bug #3...

📋 Bug Details:
- ID: #3
- Component: search-query-builder.ts
- Description: Skills penalty calculation incorrect when skills excluded from filters
- Priority: P0 🔴
- AC: When skillNames is empty array, penalty should be 0, not null

📂 Loaded context:
- src/core/search-query-builder.ts (current implementation)
- tests/integration/search-manager/skills-excluded.integration.ts
- memory-bank/decisions/creative-20250110-skills-scoring.md

🔍 Analysis:
The bug is in the CASE WHEN clause - it does not handle empty array case correctly.

Ready to fix. Should I proceed or do you want to give specific instructions?

User: proceed

Assistant: [fixes the bug following standard workflow with reviewer + qa]

✅ Bug #3 fixed and marked as RESOLVED\!

📝 Changes:
- Updated coalesce logic in search-query-builder.ts:142
- Added test case for empty skillNames array

✅ Quality checks:
- npm run lint: PASSED ✓
- tsc --noEmit: PASSED ✓
- integration tests: PASSED ✓ (12/12)

✅ Updated bugs-registry.md:
- Status: OPEN → RESOLVED
- Linked commit: a3f2b1c

You can run /sync-memory at end of session to archive this bug.
```

---

## Notes

- **Интерактивный выбор**: ОБЯЗАТЕЛЬНО используй `AskUserQuestion` tool - создает удобные табы в UI для каждого бага
- **Фильтр**: Показываются только OPEN баги (status \!= RESOLVED)
- **Контекст**: Загружай на свое усмотрение - affected files, tests, git history, Memory Bank
- **Workflow**: Обязательные вызовы reviewer + qa после фикса
- **Quality gates**: Автоматически запускаются lint + tsc + integration tests
- **Registry update**: Автоматически меняется статус на RESOLVED + добавляется commit link
