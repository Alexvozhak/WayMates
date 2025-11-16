---
name: implement-facade
description: Реализовать Facade MCP Server. Роутинг к контексту, протокол работы, правила автономности.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

# Facade Implementation

Реализуешь **Facade MCP Server** - NLP Gateway между клиентами и Core бизнес-логикой.

**Результат**: Production-ready Facade с 5 MCP Tools + BaseTool + session + normalization + LangGraph.

---

## 🧭 Навигация по контексту

### Базовая навигация (загружай при старте)

| Файл | Зачем |
|------|-------|
| `docs/architecture/facade/implementation-roadmap.md` | **ГЛАВНЫЙ** - статус TASK, решения, блокеры |
| `docs/architecture/facade/facade-class-diagram.puml` | Структура классов |
| `.claude/context/project.md` | Code style, паттерны, quality gates |
| `eslint.config.mjs` | Lint rules - помни при написании |

### Architecture Decision Records (по необходимости)

| ADR | Тема | Когда читать |
|-----|------|--------------|
| **ADR-001** | Hybrid Approach (Simple + LangGraph) | TASK-000, TASK-200 |
| **ADR-002** | LangGraph Workflows | TASK-200 (add_experience) |
| **ADR-003** | Redis + SQLite для Auth/Sessions | TASK-000 (SessionMiddleware) |
| **ADR-004** | Three-Tier Normalization | TASK-001/002, TASK-101/102 |
| **ADR-005** | UUID v7 Identifiers | При генерации ID |
| **ADR-006** | BaseTool Pattern | **TASK-000** (рефакторинг) |
| **ADR-007** | Dependency Injection | **TASK-000** (DI wiring) |

### По типу задачи (загружай по необходимости)

| Нужно | Файл |
|-------|------|
| Code style | `eslint.config.mjs` + `project.md` (Code Organization) |
| Типы | `project.md` (Data Format Standards) + `grep "export type" src/shared/` |
| Тесты | `.claude/routers/test/router.md` → загрузит standards.md |
| Architecture | `project.md` (Architecture Patterns) |

### По конкретной TASK

| TASK | Доп. файлы |
|------|-----------|
| TASK-000 | `ADR-001-hybrid-approach-facade-mcp.md` |
| TASK-001/002 | `normalization-workflow.md` |
| TASK-100-103 | `scenarios/01-search.md` и аналогичные |
| TASK-200 | `scenarios/05-add-experience-happy.md`, `ADR-002-langgraph-workflows.md` |

**Принцип**: Загружай ТОЛЬКО нужное для ТЕКУЩЕГО шага.

**❌ НЕ делай**: Читать всё сразу, пропускать roadmap при старте

---

## 🚀 Протокол начала сессии

### Шаг 1: Roadmap
```bash
Read docs/architecture/facade/implementation-roadmap.md
```

Проверь:
- Какие TASK завершены ("Принятые решения")
- Текущий статус (pending/in_progress/blocked)
- Блокеры

### Шаг 2: Контекст
```bash
Read docs/architecture/facade/facade-class-diagram.puml
Read .claude/context/project.md
```

Для текущей TASK - загрузи:
- **Релевантные ADR** (см. таблицу Navigation)
- **Специфичные файлы** (scenarios, workflows)

**Пример**:
- TASK-000: Read ADR-006, ADR-007
- TASK-101: Read ADR-004 (normalization)

### Шаг 3: Возобновление или старт

**Если TASK in_progress**:
- Загрузи код из `src/facade/`
- Продолжи

**Если TASK pending**:
- Type schema first
- TodoWrite для трекинга
- Следуй workflow ниже

---

## 📋 Фазы реализации

**Детали**: `implementation-roadmap.md`

**Кратко**:
- **Phase 0**: TASK-000 (refactoring), TASK-001/002 (Dictionaries)
- **Phase 1**: TASK-100-103 (simple tools)
- **Phase 2**: TASK-200 (LangGraph)

---

## ⚙️ Правила работы

### Автономность

**Medium Autonomy** (default):
- ✅ Принимаешь решения для implementation details
- ✅ Спрашиваешь перед major architectural changes
- ✅ Показываешь результат после завершения TASK
- ❌ НЕ спрашиваешь про каждый файл/класс

### Недостающая информация в доках

**Ask immediately**:
- Останавливаешься
- Задаешь вопрос через AskUserQuestion
- Ждешь ответа
- Документируешь решение в roadmap "Принятые решения"

### Работа с агентами

**After TASK done** (не раньше!):
- `reviewer` - bugs, edge cases, DRY
- `qa` - test quality, coverage

**❌ НЕ делай**: Вызывать после каждого файла. Один раз после завершения TASK целиком.

### Обновление roadmap

**End of TASK** (не в процессе!):

Добавь в "Принятые решения":
```markdown
### TASK-XXX: [название]
- **Решение**: [что сделали]
- **Причина**: [почему так]
- **Альтернативы**: [что отклонили]
- **Дата**: 2025-11-XX
```

---

## 🎯 Workflow для TASK

**8 шагов**:

1. **Roadmap** → статус
2. **Context** → диаграмма + сценарий (см. навигацию)
3. **Standards** → eslint + project.md (если не загружены)
4. **Type schema** → Zod → infer
5. **Implement** → BaseTool pattern, DI
6. **Tests** → **integration first**, unit если нужны моки
7. **Quality gates** → `npm run lint && npx tsc --noEmit && npm test`
8. **Roadmap** → добавь решение

**КРИТИЧНО**: Архитектура УЖЕ проработана. DON'T redesign, DO implement по диаграммам.

**❌ Топ-5 критичных анти-паттернов**:
1. Redesign архитектуры (следуй диаграммам)
2. Реэкспорты `export *` (запрещены ESLint)
3. Default exports (только named)
4. Комментарии (код self-explanatory)
5. Roadmap в процессе (только после TASK)

---

## 🔑 Ключевые паттерны

### BaseTool Pattern (ADR-006)

**Template Method**: Abstract class с `execute()` (session + errors) + `executeImpl()` (tool logic).

**DRY Benefits**: Session validation в одном месте, unified error handling, ESLint compliant (<60 lines per method).

**Exception**: AddExperienceTool = thin wrapper (LangGraph имеет свою execution flow).

Details: **ADR-006**

### Dependency Injection (ADR-007)

**Constructor Injection**: Tools получают dependencies (SessionMiddleware, Normalizer, CoreRestClient) через конструктор.

**Singleton Lifecycle**: Services создаются один раз при старте Facade, переиспользуются между requests.

**Stateless Requirement**: Services НЕ хранят request-specific state (только config в instance fields).

Details: **ADR-007**

### Type-First

```
Zod schema → infer type → implement → reviewer validates
```

Перед созданием типа:
```bash
grep -r "export type" src/shared/types/
```

**❌ НЕ делай**:
- Создавать типы без grep (дублирование)
- Inline imports: `import {type Foo}` → разделяй отдельно
- Писать код до type schema

### Session Management (ADR-003)

**Redis Sessions** (TTL 1h): Active sessions хранятся in-memory для fast auth (~1-5ms).

**SQLite Users**: Persistent user data (user_id, token) в `auth.db`.

**Automatic Cleanup**: Redis EXPIRE handles TTL, zero maintenance code.

Details: **ADR-003**

### Normalization (ADR-004)

**Three-Tier**: Redis cache (TTL 24h) → Neo4j persistent → WebSearch verification.

**Quality Assurance**: Only verified terms cached, unverified → admin moderation.

**Performance**: ~1-5ms (99% cache hit) vs ~500-1000ms (LLM-only).

Details: **ADR-004**

```
Redis (TTL 24h) → Neo4j via Core → WebSearch
```

user input → canonical name OR ValidationError

### Testing Priority

```
Integration (real deps) > Unit (mocks)
```

- ✅ Integration с real Redis, Core REST API
- ⚠️ Unit ТОЛЬКО если integration невозможен
- ❌ After schema changes → integration ОБЯЗАТЕЛЬНЫ

Fixtures - JSON в `data/trails/users/`, НЕ inline.

**❌ НЕ делай**:
- Dump JSON в test файлы (fixtures в `data/trails/users/`)
- Coverage theater (тести business logic, не Zod)

---

## 🚦 Quality Gates

**Перед commit**:
```bash
npm run lint && npx tsc --noEmit && npm run test:unit
```

**После schema changes**:
```bash
npm run test:integration  # ОБЯЗАТЕЛЬНО
```

---

## 🆘 Если застрял

**Проверь по порядку**:
1. `npm run lint && npx tsc --noEmit` - чистые ли ошибки?
2. Roadmap "Принятые решения" - решали ли это раньше?
3. `grep` по `docs/architecture/facade/` - есть ли ответ?
4. При конфликте docs → приоритет: roadmap > diagram > ADR > scenarios
5. **При конфликте промпта с ADR** → AskUserQuestion (ADR может быть outdated или промпт)
6. **При недостающей инфо** → AskUserQuestion, останавливайся, спрашивай, документируй

**Специфичные проблемы**:
- **Lint**: Read `eslint.config.mjs` - вспомни правила
- **Types**: Проверь `.js` extensions в imports (даже для `.ts`)
- **Tests**: Fixtures в `data/trails/users/`, integration с real Redis + Core

---

## 📊 Tracking

**TodoWrite**:
- ✅ Mark completed СРАЗУ
- ✅ ONE task in_progress

**Roadmap**:
- После TASK → добавь в "Принятые решения"

---

**Начни**: Загрузи roadmap (см. протокол выше).
