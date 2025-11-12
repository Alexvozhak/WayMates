---
description: "Добавить production bug в bugs-registry.md с полным описанием и критериями приемки"
allowed-tools: ["Read", "Edit", "mcp__memory__*"]
argument-hint: "[optional: bug title]"
---

# 🐛 Report Bug для WayMates

$ARGUMENTS

## Цель

Зарегистрировать production bug или design flaw в `memory-bank/knowledge/bugs-registry.md`:
- Добавить строку в таблицу Registry
- Добавить детальное описание в Bug Details
- Создать Memory MCP entity для трекинга

---

## Процесс

### Шаг 1: Собрать информацию (интерактивно)

Спросить у пользователя (или вывести из контекста):

1. **Bug Title** (краткое описание, ≤ 60 chars)
   - Пример: "Skills penalty applied when skills excluded"

2. **Component** (файл:строки)
   - Пример: `src/core/search-query-builder.ts:186-204`

3. **Priority** (P0/P1/P2)
   - 🔴 P0: Blocking, affects correctness
   - 🟡 P1: Important, affects maintainability/UX
   - 🟢 P2: Nice to have, minor issues

4. **How to Reproduce** (код/команда)
   - Минимальный воспроизводимый пример

5. **Expected vs Actual**
   - Что ожидаем vs что получаем

6. **Root Cause** (если известен)
   - Cypher snippet / код с комментарием

7. **Impact** (список с ❌/⚠️)
   - Пример: "❌ Scoring mismatch", "⚠️ Workaround needed"

8. **Fix Ideas** (опционально)
   - Option 1, Option 2, etc. с Pros/Cons

9. **Acceptance Criteria** (checklist)
   - [ ] Criteria 1
   - [ ] Criteria 2

---

### Шаг 2: Обновить bugs-registry.md

#### 2.1: Добавить строку в таблицу Registry

```markdown
| ID | Date | Component | Issue | Status | Priority |
|----|------|-----------|-------|--------|----------|
| #1 | 2025-11-11 | search-query-builder | Skills penalty when excluded | Open | 🔴 P0 |
| #2 | YYYY-MM-DD | component-name | Bug title | Open | 🟡 P1 |  ← NEW
```

**ID assignment**:
- Автоматически определяю следующий ID (max ID + 1)
- Date = сегодняшняя дата (YYYY-MM-DD)
- Status = "Open"

#### 2.2: Добавить детали в Bug Details

```markdown
### #2: Bug Title Here

**Discovered**: YYYY-MM-DD (context: where/how)

**Component**: `path/to/file.ts:lines`

**How to Reproduce**:
[code block or steps]

**Expected**:
[description]

**Actual**:
[description]

**Root Cause**:
[explanation + code snippet if known]

**Impact**:
[bullet list with ❌/⚠️]

**Fix Ideas**:
**Option 1**: Description
- Pros: ...
- Cons: ...

**Acceptance Criteria**:
- [ ] Criteria 1
- [ ] Criteria 2

**Decision**: PENDING / APPROVED / REJECTED

**References**:
- Test: path/to/test.ts:line
- Memory MCP: Entity name
```

---

### Шаг 3: Memory MCP entity (ВСЕГДА)

```typescript
mcp__memory__create_entities({
  entities: [
    {
      name: "Bug #2: Bug Title",
      entityType: "bug",
      observations: [
        "Component: path/to/file.ts:lines",
        "Priority: P1",
        "Status: Open",
        "Root cause: [brief explanation]",
        "Impact: [main impact]",
        "Discovered: YYYY-MM-DD"
      ]
    }
  ]
})
```

---

### Шаг 4: Итоговый отчет

Показать пользователю:

```
✅ Bug #2 зарегистрирован в bugs-registry.md

📋 Summary:
- Title: Bug title
- Component: component-name
- Priority: 🟡 P1
- Status: Open

📝 Next steps:
- Review fix options
- Approve decision
- Implement fix (create Vikunja task via /plane-workflow if needed)

🔗 References:
- Registry: memory-bank/knowledge/bugs-registry.md#2
- Memory MCP: "Bug #2: Bug Title"
```

---

## Примеры использования

```bash
# Автоматический сбор из контекста
/report-bug

# С указанием заголовка
/report-bug "User context returns stale data"
```

---

## Правила

1. **ID assignment**: Всегда max(existing IDs) + 1
2. **Date format**: YYYY-MM-DD (ISO)
3. **Status**: Всегда "Open" при создании
4. **Component path**: Относительный от repo root
5. **Code snippets**: Используй ```typescript или ```cypher
6. **Impact bullets**: Начинай с ❌ (critical) или ⚠️ (warning)

---

💡 **После регистрации бага**: используй `/plane-workflow` для создания Vikunja task на fix (если нужен)
