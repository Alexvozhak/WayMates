# Рефакторинг cold_start агента

Ты выполняешь рефакторинг `career-collector-agent.ts` в полноценный `cold-start-agent.ts` согласно архитектуре HANDOFF.

---

## 📚 ОБЯЗАТЕЛЬНЫЙ КОНТЕКСТ (загрузить ПЕРЕД началом работы)

### Уровень 1: Source of Truth (ВСЕГДА)
```
1. docs/architecture/facade/langchain/HANDOFF-cold-start-refactoring.md
   → Архитектурные решения, 7 tools, 10 phases, state schema

2. docs/architecture/facade/langchain/REFACTORING-PLAN-cold-start.md
   → План работы, текущая фаза, прогресс, чеклисты

3. eslint.config.mjs
   → Coding standards: complexity≤8, max-depth≤2, max-lines≤60, naming conventions
```

### Уровень 2: Синтаксис LangChain v1 (ВСЕГДА)
```
4. .claude/routers/langchain/router.md → glossary.md
   → createAgent, tool(), Command, interrupt(), humanInTheLoopMiddleware
   → Критичные правила: Gemini prefix, checkpointer required, thread_id
```

### Уровень 3: Happy Path (ВСЕГДА)
```
5. docs/architecture/facade/scenarios/05-add-experience-happy.md
   → 5-phase workflow, nested queue, JSON-only responses
```

### Уровень 4: По необходимости
```
6. src/facade/langchain/shared-tools/*.ts (при работе с shared tools)
7. src/schemas-zod.ts (при работе с типами UserContext, Trail)
8. src/facade/langchain/career-collector-agent.ts (legacy для удаления)
```

---

## 🎯 ЦЕЛЬ РЕФАКТОРИНГА

| Было | Станет |
|------|--------|
| ONE context | MANY contexts + MANY trails |
| 4 statuses | 10 phases |
| 4 tools | 7 tools (4 shared + 3 agent-specific) |
| Normalization в agent | Silent normalization в MCP ручке |
| saveCareerDataTool | Save в MCP ручке |

### 7 Tools (финальный inventory)
**Shared (4)**:
- `extractSingleContextTool` - извлечение ONE context
- `extractSingleTrailTool` - извлечение ONE trail
- `askClarificationTool` - interrupt для вопросов
- `confirmDataTool` - interrupt для подтверждения

**Agent-specific (3)**:
- `planCareerHistoryTool` - анализ истории, генерация queue с contextId upfront
- `processEntityBatchTool` - обработка ONE context + ALL its incoming trails
- `editEntityTool` - minor corrections без re-extraction

---

## 🚨 ЗАПРЕТЫ (20 правил)

### Код (11)
1. ❌ НЕ делать реэкспорты (`export * from`)
2. ❌ НЕ использовать inline типы - выносить в types.ts
3. ❌ НЕ использовать `any` - только явные типы
4. ❌ НЕ использовать type assertions (`as`) - только Zod `.parse()/.safeParse()` или type guards
5. ❌ НЕ превышать complexity 8 - разбивать на функции
6. ❌ НЕ превышать max-depth 2 - рефакторить вложенность
7. ❌ НЕ превышать 60 строк на функцию
8. ❌ НЕ добавлять doxygen комментарии
9. ❌ НЕ оставлять временные комментарии (TODO, FIXME без issue)
10. ❌ НЕ создавать типы без проверки через grep на существующие
11. ❌ НЕ нарушать naming conventions - camelCase, PascalCase для типов

### Архитектура (5)
12. ❌ НЕ додумывать бизнес-логику - СПРАШИВАТЬ
13. ❌ НЕ менять HANDOFF решения - это source of truth
14. ❌ НЕ создавать новые .md файлы без согласования
15. ❌ НЕ пропускать checkpoints - ждать одобрения
16. ❌ НЕ переходить к следующей фазе без завершения текущей

### Process (4)
17. ❌ НЕ запускать lint без fix - сразу исправлять
18. ❌ НЕ игнорировать TypeScript ошибки
19. ❌ НЕ оставлять рудименты - удалять неиспользуемый код
20. ❌ НЕ смешивать разные задачи - одна фаза = один scope

---

## 📞 ТРИГГЕРЫ ВЫЗОВА ПОЛЬЗОВАТЕЛЯ

### ОБЯЗАТЕЛЬНО звать когда:

**Бизнес-логика**:
- "Как обрабатывать X в случае Y?"
- "Должен ли trail быть обязательным?"
- Любая неясность в требованиях

**Выбор между альтернативами**:
- "Два подхода к реализации: A vs B - какой выбрать?"
- "Нейминг: optionA vs optionB?"
- Любой выбор без очевидного ответа

**Изменение публичного API**:
- Изменения в tool inputs/outputs
- Изменения в state schema
- Изменения в MCP ручке

**Конфликты с HANDOFF**:
- "HANDOFF говорит X, но код делает Y"
- Несоответствие в документации
- Противоречие между источниками

**Checkpoints (после КАЖДОЙ фазы)**:
- Phase 1 завершена → показать types.ts → ЖДАТЬ ✅
- Phase 2 завершена → показать tools → ЖДАТЬ ✅
- И так далее для всех 7 фаз

**Удаление кода**:
- "Удаляю career-collector-agent.ts - подтвердите"
- "Удаляю функцию X - она не используется"
- Любое удаление > 10 строк

**Ошибки**:
- Если lint/tsc ошибка неочевидная
- Если fix требует архитектурного решения
- Если тесты падают по непонятной причине

---

## 📋 ФАЗЫ РАБОТЫ

### Phase 1: Подготовка типов
- Создать `src/facade/langchain/cold-start/types.ts`
- Типы: ColdStartPhase, ContextAgenda, MissingField, ColdStartState
- **CHECKPOINT** → показать файл → ждать ✅

### Phase 2: Agent-specific tools
- `plan-career-history.tool.ts`
- `process-entity-batch.tool.ts`
- `edit-entity.tool.ts`
- **CHECKPOINT** → показать tools → ждать ✅

### Phase 3: Адаптация shared-tools
- Ревью совместимости с новой архитектурой
- Адаптация при необходимости
- **CHECKPOINT** → показать изменения → ждать ✅

### Phase 4: cold-start-agent.ts
- State schema с 10 phases
- System prompt с hybrid routing
- 7 tools inventory
- **CHECKPOINT** → показать agent → ждать ✅

### Phase 5: MCP ручка
- Silent normalization
- Save через coreClient
- Idempotency + cleanup
- **CHECKPOINT** → показать изменения → ждать ✅

### Phase 6: Legacy cleanup
- Удаление career-collector-agent.ts
- Обновление импортов
- **CHECKPOINT** → подтвердить удаление → ждать ✅

### Phase 7: Quality Gates
- `npm run lint:fix` - без ошибок
- `npx tsc --noEmit` - без ошибок
- Ревью агентом reviewer
- QA агентом qa
- **ФИНАЛЬНЫЙ CHECKPOINT** → ждать ✅

---

## ✅ КРИТЕРИИ ЗАВЕРШЕНИЯ

- [ ] Все 7 tools реализованы и работают
- [ ] 10 phases корректно переключаются
- [ ] Lint проходит без ошибок
- [ ] TypeScript компилируется без ошибок
- [ ] Happy path сценарий проходит
- [ ] Legacy код удален
- [ ] Нет рудиментов и мертвого кода
- [ ] Документация актуальна

---

## 🔄 ПЕРЕД КАЖДЫМ ДЕЙСТВИЕМ

1. **Проверь текущую фазу** в REFACTORING-PLAN-cold-start.md
2. **Загрузи необходимый контекст** (уровни 1-3 обязательно)
3. **Проверь запреты** (20 правил выше)
4. **Выполни задачу** текущей фазы
5. **Запусти lint + tsc** после изменений
6. **Покажи результат** и жди checkpoint

---

## ⚠️ ВАЖНО

- **HANDOFF = Source of Truth** - не отступать от решений
- **Checkpoint после КАЖДОЙ фазы** - не пропускать
- **При сомнениях - СПРАШИВАТЬ** - не додумывать
- **Качество важнее скорости** - не торопиться
