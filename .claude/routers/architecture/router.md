# Architecture Router

**Используй при**: Архитектурная проработка фич (системный анализ, ТЗ, C4 model).

---

## 📚 Загрузить перед началом

**ОБЯЗАТЕЛЬНО загрузить**:
1. `.claude/commands/plan-feature.md` - Workflow (10 фаз)
2. `.claude/routers/architecture/checklist.md` - Чеклист для отслеживания
3. `memory-bank/knowledge/features-registry.md` - Features для выбора
4. `docs/architecture/workflows/facade/langgraph/architecture.md` - Существующий doc (если есть)

**Дополнительно** (по необходимости):
- `01_business_requirements.md` - Бизнес-контекст фичи
- `00_open_questions.md` - Решенные вопросы (Q1-Q9)

---

## 🎯 Workflow Overview

См. детальный workflow в `/plan-feature` (10 фаз с checkpoints):

1. **Phase 0**: Выбор фичи из реестра
2. **Phase 1**: Problem Analysis
3. **Phase 2**: Alternatives Analysis
4. **Phase 3**: User Scenarios (с system internals!)
5. **Phase 4**: Dataflow Diagram
6. **Phase 5**: Component Interaction
7. **Phase 6**: Edge Cases
8. **Phase 7**: Type Contracts
9. **Phase 8**: Risks & Mitigations
10. **Phase 9**: Implementation Plan (TodoList)
11. **Phase 10**: C4 Diagrams (визуализация)

**Checkpoint после КАЖДОЙ фазы** - ждать утверждения пользователя!

---

## 🔑 Ключевые принципы

### 1. Сверху вниз (но НЕ через C4!)
❌ **НЕ начинай с C1 Context diagram!**
✅ **Начни с Problem Analysis** - что решаем, почему сложно

**Правильный порядок**:
1. Problem → Alternatives → Scenarios → Dataflow → Components
2. ТОЛЬКО ПОТОМ → C4 diagrams (как визуализация)

### 2. System Internals обязательны
❌ **Плохо**: "User: Добавь опыт → Bot: Ок, добавлено"
✅ **Хорошо**:
```
User: "Добавь опыт"
  ↓ [System: LibreChat LLM reasoning]
  ↓ [System: MCP call add_experience({message})]
  ↓ [System: Facade auth → userId]
  ↓ [System: LangGraph starts → prepare node]
  ↓ [System: Core.get_dictionaries() → Neo4j query]
  ↓ ...
Bot: "Какой город?"
```

### 3. Один документ
✅ **Обновляй**: `architecture.md`
❌ **НЕ создавай**: новые .md файлы без обсуждения

### 4. Checkpoints обязательны
После каждой фазы:
1. Показать результат
2. Задать вопросы (AskUserQuestion)
3. Дождаться ✅
4. НЕ переходить дальше без одобрения

---

## ⚠️ Типичные ошибки

### ❌ Ошибка 1: Перепрыгнул на C4 diagrams до проработки сценариев
**Симптом**: Начинаешь рисовать Container diagram без Phase 3-5
**Fix**: Вернись к Phase 1, иди по порядку: Problem → Scenarios → Dataflow → Components → ПОТОМ diagrams

### ❌ Ошибка 2: Сценарии без system internals
**Симптом**: "User делает X → Bot отвечает Y" (черный ящик)
**Fix**: Показать ЧТО происходит внутри:
- Какие компоненты задействованы
- Какие API calls
- Какие DB queries
- Какие state updates

### ❌ Ошибка 3: Создал новый .md файл
**Симптом**: `03_critical_decisions.md`, `04_implementation_plan.md`, etc
**Fix**: Обнови ОДИН файл: `architecture.md`

### ❌ Ошибка 4: Перешел к следующей фазе без checkpoint
**Симптом**: Завершил Phase 3, сразу начал Phase 4 без утверждения
**Fix**: После каждой фазы показывай результат, жди ✅

### ❌ Ошибка 5: Начал писать код
**Симптом**: "Вот реализация node.ts..."
**Fix**: СТОП! Архитектура не завершена. Завершить Phase 1-10, ПОТОМ coding

### ❌ Ошибка 6: Смешал уровни C4
**Симптом**: C2 Container + C3 Components в одном разделе
**Fix**: Четкое разделение:
- C1 (System Context) - отдельный раздел
- C2 (Containers) - отдельный раздел
- C3 (Components) - отдельный раздел для КАЖДОГО контейнера

---

## 🛠️ Когда использовать

### ✅ Используй `/plan-feature` когда:
- Новая фича из features-registry.md
- Сложная архитектурная задача (multi-component, workflow, integration)
- Нужно проработать dataflow и edge cases
- Нужно готовое ТЗ для разработчиков

### ❌ НЕ используй когда:
- Простой bugfix (используй `/fix-bug`)
- Trivial task (<1 час работы)
- Только документация (не требует coding)

---

## 📋 Быстрый старт

```bash
# 1. Загрузить контекст
- Read: .claude/commands/plan-feature.md
- Read: .claude/routers/architecture/checklist.md
- Read: memory-bank/knowledge/features-registry.md

# 2. Выбрать фичу (через AskUserQuestion)
- Показать список TODO фич
- Дать выбрать feature_id

# 3. Следовать workflow (10 фаз)
- Phase 1: Problem Analysis
- Phase 2: Alternatives
- ...
- Phase 10: Diagrams

# 4. Checkpoint после КАЖДОЙ фазы
- Показать результат
- Задать вопросы
- Дождаться ✅
```

---

## 🎯 Цель работы

После `/plan-feature` должно быть:
- ✅ Готовое ТЗ (что реализовать + DoD)
- ✅ TodoList (для трекинга между сессиями)
- ✅ Риски (идентифицированы + митигированы)
- ✅ Edge cases (предусмотрены)
- ✅ Type contracts (определены)
- ✅ Диаграммы (как визуализация проработки)

**Результат**: Уверенность в подходе, никаких сюрпризов при имплементации.

---

**См. также**:
- `.claude/commands/plan-feature.md` - Детальный workflow
- `.claude/routers/architecture/checklist.md` - Чеклист для прогресса
- `.claude/context/project.md` - Architecture Workflow секция
