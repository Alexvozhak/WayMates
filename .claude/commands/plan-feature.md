# /plan-feature - Системная архитектурная проработка

**Синтаксис**: `/plan-feature [feature_id]`

**Цель**: Подготовить ГОТОВОЕ ТЗ к имплементации с проработкой всех сценариев, dataflow, edge cases, рисков.

---

## 🎯 Что делает архитектор

Архитектор НЕ рисует диаграммы. Архитектор:

1. **Исследует проблему** (что решаем, почему сложно)
2. **Анализирует альтернативы** (какие подходы есть, почему выбрали этот)
3. **Прорабатывает сценарии пользователя** (User Stories с system internals)
4. **Прорабатывает dataflow** (как данные идут через систему)
5. **Прорабатывает component interaction** (кто кого дергает, interfaces)
6. **Прорабатывает edge cases** (что если...)
7. **Определяет type contracts** (public API, internal state)
8. **Оценивает риски** (что может пойти не так + митигации)
9. **Формирует готовое ТЗ** (TodoList + Definition of Done)
10. **Визуализирует** (C4 diagrams как ИЛЛЮСТРАЦИЯ проработки)

---

## 📋 Workflow (10 фаз с checkpoints)

### Phase 0: Выбор фичи из реестра

**Задачи**:
1. Загрузить `memory-bank/knowledge/features-registry.md`
2. Показать список TODO фич с приоритетами
3. Дать выбрать feature_id через AskUserQuestion
4. Загрузить контекст фичи (Acceptance Criteria, motivation, impact, dependencies)
5. **Спросить формат output** через AskUserQuestion:
   - Куда складывать результаты планирования?
   - Варианты:
     - Единый architecture spec (features-X-Y-architecture.md)
     - Отдельные документы по фазам (Problem Analysis, Dataflow, etc)
     - Только ADR (minimal approach)

**Output**: Feature context loaded + output format согласован

**Checkpoint**: ✅ Фича выбрана, контекст понятен, формат output определен

---

### Phase 1: Анализ проблемы (Problem Analysis)

**Задачи**:
1. Сформулировать проблему четко:
   - **Что** решаем (техническая задача)
   - **Почему** это проблема (бизнес-контекст)
   - **Кто** затронут (пользователи, компоненты)
2. Показать текущее состояние (as-is)
3. Показать желаемое состояние (to-be)
4. Объяснить, **почему это сложно** (технические вызовы)

**Формат**:
```markdown
## 1. Problem Analysis

### Проблема
[Четкая формулировка: что, почему, кто]

### Текущее состояние (As-Is)
[Как работает сейчас, что не устраивает]

### Желаемое состояние (To-Be)
[Как должно работать после фичи]

### Почему это сложно
[Технические вызовы, которые нужно решить]
```

**Вопросы для уточнения** (через AskUserQuestion):
- Какие пользователи затронуты фичей?
- Какие альтернативные решения рассматривались?
- Какие ограничения есть (технические, бизнес, бюджет)?
- Понятна ли проблема или нужны дополнительные детали?

**Output**: Раздел "1. Problem Analysis" в `architecture.md`

**Checkpoint**: ✅ Проблема четко сформулирована, пользователь согласен

---

### Phase 2: Анализ альтернатив (Alternatives Analysis)

**Задачи**:
1. Перечислить ВСЕ возможные подходы к решению (минимум 2-3)
2. Сравнить по критериям:
   - Сложность реализации
   - Time-to-market
   - Технические риски
   - Long-term maintenance
   - Масштабируемость
3. Рекомендовать лучший вариант с обоснованием
4. Оформить как ADR (Architecture Decision Record)

**Формат**:
```markdown
## 2. Alternatives Analysis

| Решение | Плюсы | Минусы | Сложность | Риски | Time-to-Market | Вердикт |
|---------|-------|--------|-----------|-------|----------------|---------|
| A: ... | ... | ... | LOW | MEDIUM | 1 week | ❌ |
| B: ... | ... | ... | HIGH | LOW | 3 weeks | ✅ Выбрано |
| C: ... | ... | ... | MEDIUM | HIGH | 2 weeks | ❌ |

### Рекомендация: Решение B

**Обоснование**:
[Почему выбрали именно этот подход]

**Trade-offs**:
[Что принимаем как компромисс]
```

**Вопросы для уточнения**:
- Есть ли альтернативы, которые я не рассмотрел?
- Какие критерии важнее: time-to-market или long-term maintenance?
- Готовы ли принять trade-off X для решения Y?

**Output**: Раздел "2. Alternatives Analysis" + ADR-XXX в конце документа

**Checkpoint**: ✅ Выбор подхода согласован, обоснование понятно

---

### Phase 3: Сценарии пользователя (User Scenarios)

**Задачи**:
1. Описать ВСЕ сценарии использования фичи:
   - Happy path (основной сценарий)
   - Alternative paths (альтернативные варианты)
   - Edge cases (граничные случаи)
2. Для каждого сценария ДЕТАЛЬНО расписать:
   - **Preconditions** (начальное состояние)
   - **User actions** (что делает пользователь)
   - **System internals** (что происходит ВНУТРИ системы - КРИТИЧНО!)
   - **Postconditions** (конечное состояние)
3. Показать потоки данных, API calls, DB queries

**Формат**:
```markdown
## 3. User Scenarios

### Сценарий 1: [Название] (Happy Path)

**Preconditions**: [Начальное состояние]

**User actions**:
1. User: [Действие пользователя]
   ↓ [System: Что происходит внутри - детально!]
   ↓ [System: Компонент A вызывает Компонент B]
   ↓ [System: API call: endpoint({params})]
   ↓ [System: DB query: MATCH ... RETURN ...]
   ↓ [System: State update: field = value]
   Bot: [Ответ системы]

2. User: [Следующее действие]
   ↓ [System: ...]
   Bot: [Ответ]

**Postconditions**: [Конечное состояние]

**Data flow**:
- Input: [формат данных на входе]
- Processing: [как данные трансформируются]
- Output: [формат данных на выходе]
```

**Критично**: Показать ВСЕ системные компоненты, которые задействованы!

**Вопросы для уточнения**:
- Есть ли сценарии, которые я пропустил?
- Как обрабатывать случай X?
- Правильно ли я понял взаимодействие компонентов Y и Z?

**Output**: Раздел "3. User Scenarios" (минимум 3-5 сценариев)

**Checkpoint**: ✅ Все сценарии проработаны, system internals понятны, согласованы

---

### Phase 4: Dataflow (Data Flow Diagram)

**Задачи**:
1. Нарисовать ДЕТАЛЬНЫЙ поток данных через всю систему
2. Показать ВСЕ точки взаимодействия:
   - User input → Frontend
   - Frontend → Backend API
   - Backend → Services
   - Services → Database
   - External APIs
3. Указать формат данных на каждом этапе
4. Показать трансформации данных

**Формат**:
```markdown
## 4. Dataflow Diagram

### Детальный поток данных

[User input: "Python Developer в Москве"]
  ↓ LibreChat LLM reasoning
  ↓ MCP request: {tool: "add_experience", args: {message: "..."}}
  ↓ Facade: JWT validation → userId = "usr_123"
  ↓ Facade: WorkflowRunner.start({userId, message})
  ↓ LangGraph: prepare node
      ↓ Core MCP call: get_dictionaries()
          ↓ Neo4j query: MATCH (p:Position) RETURN p.name
          ↓ Neo4j response: ["Python Developer", "Java Developer", ...]
      ↓ Redis: cache.set("dict:positions", [...], TTL=24h)
      ↓ State update: state.dictionaries = [...]
  ↓ LangGraph: extract node
      ↓ OpenAI API call: {messages: [...], schema: UserContextSchema}
      ↓ OpenAI response: {position: "Python Developer", city: "Москва"}
      ↓ State update: state.extractedContext = {position, city}
  ↓ LangGraph: semantic node
      ↓ Validation logic: check required fields
      ↓ Validation result: missing = ["skills", "start_date"]
      ↓ State update: state.semanticErrors = [...]
  ↓ LangGraph: clarify node (INTERRUPT)
      ↓ Redis: checkpoint.save(thread_id="t123", state={...})
      ↓ Response: {status: "waiting", thread_id: "t123", question: "..."}
  ↓ Facade → LibreChat: JSON response
  ↓ LibreChat shows question to user

### Mermaid Diagram
[Визуализация потока данных]
```

**Вопросы для уточнения**:
- Где кешируются данные и на сколько?
- Какие данные персистятся и где?
- Какие трансформации данных происходят?
- Правильно ли я понял формат данных на этапе X?

**Output**: Раздел "4. Dataflow Diagram" (текст + Mermaid diagram)

**Checkpoint**: ✅ Dataflow понятен, все точки взаимодействия проработаны

---

### Phase 5: Component Interaction (кто кого дергает)

**Задачи**:
1. Перечислить ВСЕ компоненты системы (включая внешние)
2. Показать, кто кого вызывает (call graph)
3. Указать интерфейсы взаимодействия (типы параметров и возврата)
4. Показать направление зависимостей

**Формат**:
```markdown
## 5. Component Interaction

### Компоненты по уровням

**Client Layer**:
- LibreChat UI (React)
- LibreChat LLM client (tool calling)

**Facade Layer**:
- add_experience.tool
- WorkflowRunner
- LangGraph workflow (10 nodes)
- Normalizer
- AuthService
- RedisCheckpointer

**Core Layer**:
- StoryManager
- DictionariesManager
- SearchManager

**Data Layer**:
- Neo4j
- Redis

**External**:
- OpenAI API
- WebSearch API

### Взаимодействие компонентов

**add_experience.tool**:
- **Calls**: WorkflowRunner.start(), AuthService.validateToken()
- **Called by**: LibreChat MCP client
- **Interface**:
  - Input: `AddExperienceInput` = `{message: string, thread_id?: string}`
  - Output: `AddExperienceOutput` = `{status, thread_id?, question?}`

**WorkflowRunner**:
- **Calls**: LangGraph.invoke(), RedisCheckpointer.load(), RedisCheckpointer.save()
- **Called by**: add_experience.tool
- **Interface**:
  - Input: `WorkflowConfig` = `{userId, message, threadId?}`
  - Output: `WorkflowResult` = `{status, data}`

**LangGraph Nodes**:

**prepare node**:
- **Calls**: Core.get_dictionaries(), Core.get_schema()
- **Called by**: START
- **Updates**: `state.dictionaries`, `state.schema`

**extract node**:
- **Calls**: OpenAI.chat.completions.create()
- **Called by**: prepare, clarify (cycle)
- **Updates**: `state.extractedContext`

[... для всех остальных nodes]

### Dependency Graph
[Показать направление зависимостей через Mermaid]
```

**Вопросы для уточнения**:
- Какие компоненты критичны для MVP?
- Есть ли circular dependencies (и как разрываем)?
- Нужны ли fallback mechanisms для external dependencies?
- Правильно ли я понял интерфейс между X и Y?

**Output**: Раздел "5. Component Interaction"

**Checkpoint**: ✅ Взаимодействие компонентов понятно, interfaces определены

---

### Phase 6: Edge Cases (что если...)

**Задачи**:
1. Перечислить ВСЕ edge cases:
   - Ошибки пользователя (invalid input, cancellation)
   - Ошибки системы (service down, timeout)
   - Граничные условия (empty data, extreme values)
   - Concurrent operations
2. Для каждого edge case указать:
   - Вероятность
   - Влияние на систему
   - Обработку (как система реагирует)
   - Где реализовано
3. Определить acceptable failures (что можем игнорировать в MVP)

**Формат**:
```markdown
## 6. Edge Cases

| Edge Case | Вероятность | Влияние | Обработка | Где реализовано |
|-----------|-------------|---------|-----------|-----------------|
| User уходит посередине workflow | HIGH | LOW | Checkpoint в Redis, TTL 7d → resume later | RedisCheckpointer |
| User дает противоречивые данные | MEDIUM | MEDIUM | Semantic validation → clarify cycle | semantic node |
| WebSearch API недоступен | LOW | MEDIUM | Fallback: mark as unverified → admin review | canonicalize node + Feature #11 |
| LLM extraction wrong format | MEDIUM | HIGH | Schema validation fails → clarify | schema node |
| User отменяет workflow | LOW | LOW | Graceful exit, delete checkpoint | confirm node (cancel action) |
| Redis restart (checkpoints lost) | LOW | MEDIUM | User restarts workflow from scratch | Acceptable for MVP |
| Concurrent workflows (same user) | MEDIUM | MEDIUM | One active thread_id per user | WorkflowRunner logic |
| OpenAI API rate limit | LOW | HIGH | Retry with exponential backoff, queue | OpenAI client wrapper |
| Neo4j connection lost | LOW | CRITICAL | Retry mechanism, circuit breaker | Core MCP connection pool |

### Acceptable Failures (для MVP)
- Redis restart → lost checkpoints (user restarts)
- WebSearch unavailable → admin moderation
- ...
```

**Вопросы для уточнения**:
- Как обрабатывать случай X?
- Нужны ли retry mechanisms для Y?
- Готовы ли принять failure Z в MVP?
- Какие edge cases критичны, какие можно отложить?

**Output**: Раздел "6. Edge Cases"

**Checkpoint**: ✅ Все edge cases предусмотрены, handling согласован

---

### Phase 7: Type Contracts (Public API + State)

**Задачи**:
1. Определить **Public API** (что видит клиент):
   - Tool inputs/outputs
   - HTTP endpoints (если есть)
   - Event schemas
2. Определить **Internal State** (что хранится внутри):
   - Workflow state
   - Cache structures
   - Database schemas
3. Определить **Component Interfaces** (границы между компонентами):
   - Service interfaces
   - Repository interfaces
   - DTO schemas

**Формат**:
```typescript
## 7. Type Contracts

### Public API (что видит клиент)

// MCP Tool: add_experience
type AddExperienceInput = {
  message: string;        // Natural language user input
  thread_id?: string;     // For resuming interrupted session
};

type AddExperienceOutput =
  | { status: 'waiting'; thread_id: string; question: string; type: 'clarification' | 'confirmation' }
  | { status: 'complete'; context_id: string; message: string }
  | { status: 'cancelled'; message: string };

### Internal State (что хранится внутри)

// Redis checkpoint schema
type WorkflowState = {
  userId: string;
  messages: string[];                        // Conversation history for LLM

  // Phase 1: Fragment Collection
  extractedContext: Partial<UserContext>;    // Accumulating data from user

  // Phase 2-3: Version Lock
  lockedContext?: UserContext;               // Fixed version after preview
  previewGenerated: boolean;
  userCorrections: string[];

  // Validation errors
  semanticErrors: string[];
  schemaErrors: string[];
  normalizationErrors: string[];

  // Current phase
  phase: 'collection' | 'preview' | 'refinement';
};

// Redis cache schema
type DictionaryCacheEntry = {
  canonical: string;
  verified: boolean;
  source: 'initial' | 'user_input' | 'kaggle' | 'admin';
  addedBy?: string;
  createdAt: number;
};

### Component Interfaces (границы между компонентами)

// Normalizer Service
interface NormalizerInput {
  text: string;
  type: 'position' | 'skill' | 'domain';
  userId: string;
}

interface NormalizerOutput {
  canonical: string;
  verified: boolean;
  warnings?: string[];  // For unverified terms requiring admin review
}

// Core MCP: DictionariesManager
interface GetDictionariesInput {
  types?: ('position' | 'skill' | 'domain')[];  // Filter by type
  verified?: boolean;                            // Filter by verification status
}

interface GetDictionariesOutput {
  positions: string[];
  skills: string[];
  domains: string[];
}

// LangGraph Node interface
interface WorkflowNode<TState> {
  execute(state: TState, config: RunnableConfig): Promise<Partial<TState>>;
}
```

**Вопросы для уточнения**:
- Какие поля обязательные, какие опциональные?
- Нужна ли версионность API для backward compatibility?
- Нужны ли дополнительные поля для будущих фич?
- Правильно ли я понял структуру state для workflow?

**Output**: Раздел "7. Type Contracts"

**Checkpoint**: ✅ Type contracts согласованы, API design утвержден

---

### Phase 8: Риски и митигации

**Задачи**:
1. Идентифицировать **все технические риски**:
   - Архитектурные риски
   - Технологические риски (новые библиотеки)
   - Интеграционные риски (external APIs)
   - Performance риски
2. Оценить каждый риск:
   - **Вероятность**: LOW / MEDIUM / HIGH
   - **Влияние**: LOW / MEDIUM / HIGH / CRITICAL
3. Предложить **митигации** (как снизить риск)
4. Определить **owner** (кто отвечает за митигацию)

**Формат**:
```markdown
## 8. Risks & Mitigations

| Риск | Вероятность | Влияние | Митигация | Owner | Статус |
|------|------------|---------|-----------|-------|--------|
| LibreChat LLM не поймет multi-call pattern | HIGH | CRITICAL | 1. Детальный system prompt с примерами<br>2. E2E тесты перед MVP<br>3. Fallback: упростить workflow (меньше interrupts) | Facade | TODO |
| Redis memory overflow (checkpoints) | LOW | MEDIUM | 1. Aggressive TTL (7 days)<br>2. Memory monitoring<br>3. Cleanup job для старых checkpoints | Infrastructure | TODO |
| LangGraph bugs (новая библиотека) | MEDIUM | HIGH | 1. Extensive unit tests для каждого node<br>2. Integration tests для full workflow<br>3. Fallback: direct Core calls без LangGraph | Facade | TODO |
| OpenAI API rate limits | LOW | MEDIUM | 1. Request caching<br>2. Exponential backoff retry<br>3. Queue для sequential processing | Facade | TODO |
| Versioning logic breaks (Phase 1→3) | MEDIUM | HIGH | 1. Unit tests для каждой фазы<br>2. Integration tests для correction flow<br>3. Reviewer validation перед merge | Facade | TODO |
| WebSearch API недоступен | LOW | LOW | 1. Fallback: mark unverified<br>2. Admin moderation (Feature #11) | Facade | ACCEPTABLE |
| Neo4j connection pool exhausted | LOW | CRITICAL | 1. Connection pooling<br>2. Circuit breaker pattern<br>3. Monitoring + alerts | Core | TODO |

### Критичные риски (требуют внимания)
1. **LibreChat LLM не поймет multi-call** - блокирует MVP
2. **LangGraph bugs** - новая библиотека, непроверенная
3. **Versioning logic** - сложная логика, риск регрессий

### Acceptable Risks (для MVP)
- WebSearch API unavailable → admin moderation
- Redis restart → lost checkpoints (user restarts)
```

**Вопросы для уточнения**:
- Какие риски критичны для MVP?
- Нужны ли дополнительные митигации для риска X?
- Готовы ли принять риск Y без митигации?
- Правильно ли я оценил вероятность/влияние?

**Output**: Раздел "8. Risks & Mitigations"

**Checkpoint**: ✅ Риски оценены, митигации согласованы

---

### Phase 9: Готовое ТЗ (Implementation Specification)

**Задачи**:
1. Разбить фичу на **конкретные задачи** для реализации
2. Определить **Definition of Done** для каждой задачи
3. Оценить **сроки** (в неделях/днях)
4. Создать **TodoList** через TodoWrite tool
5. Определить **порядок реализации** (dependencies между задачами)
6. Указать **критерии готовности** (тесты, метрики)

**Формат**:
```markdown
## 9. Implementation Plan

### Разбивка по неделям

**Week 1: Infrastructure Setup**
- [ ] Facade MCP Server setup (FastMCP integration)
  - DoD: Сервер запускается, принимает MCP connections
- [ ] RedisCheckpointer integration (@langchain/langgraph-checkpoint-redis)
  - DoD: Checkpoints сохраняются и восстанавливаются
- [ ] AuthService integration (JWT token validation)
  - DoD: Токены валидируются, userId извлекается корректно
- [ ] DictionariesCache setup (Redis client, TTL 24h)
  - DoD: Cache hit/miss работает, TTL применяется

**Week 2: LangGraph Workflow Core**
- [ ] LangGraph graph structure (10 nodes + conditional edges)
  - DoD: Граф компилируется без ошибок
- [ ] Nodes: prepare, extract, semantic, schema, canonicalize
  - DoD: Каждый node проходит unit tests
- [ ] WorkflowRunner (interrupt handling, resume logic)
  - DoD: Interrupts работают, resume восстанавливает state
- [ ] Integration tests: happy path (start → clarify → confirm → complete)
  - DoD: Full workflow проходит end-to-end

**Week 3: Advanced Nodes + Edge Cases**
- [ ] Nodes: clarify, preview, confirm, persist
  - DoD: Каждый node проходит unit tests + integration tests
- [ ] Version lock logic (Phase 1 → Phase 2 → Phase 3)
  - DoD: Corrections применяются только к locked context
- [ ] Edge cases handling (validation errors, cancellation, timeouts)
  - DoD: Все edge cases из Phase 6 покрыты tests
- [ ] LibreChat system prompt update
  - DoD: System prompt включает инструкции для multi-call pattern

**Week 4: Testing + Documentation**
- [ ] E2E tests (3 scenarios: happy path, interrupted session, correction flow)
  - DoD: Все сценарии проходят с real LibreChat
- [ ] Reviewer validation (code quality, DRY, edge cases)
  - DoD: Reviewer agent не находит critical issues
- [ ] QA validation (test coverage, business logic)
  - DoD: QA agent подтверждает ≥90% business value
- [ ] Documentation update (architecture.md, setup guide)
  - DoD: Документация актуальна, setup guide работает

### Definition of Done (Overall)

**Функциональность**:
- [ ] Multi-call pattern работает (start → waiting → resume → complete)
- [ ] Checkpoints восстанавливаются после Redis restart (если AOF enabled)
- [ ] Версионность работает (Phase 1 → lock → Phase 3, corrections apply to locked)
- [ ] All user scenarios from Phase 3 реализованы

**Тестирование**:
- [ ] Unit tests: ≥80% coverage для Facade components
- [ ] Integration tests: все сценарии из Phase 3 покрыты
- [ ] E2E tests: работает с real LibreChat
- [ ] Edge cases: все из Phase 6 обработаны

**Quality Gates**:
- [ ] Lint passes (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] All tests pass (unit + integration)
- [ ] Reviewer validation (no critical issues)
- [ ] QA validation (≥90% business value)

**Метрики успеха**:
- [ ] Completion rate: ≥80% users complete data ingestion
- [ ] Avg clarify cycles: ≤3 questions per workflow
- [ ] Time to complete: ≤5 minutes per experience entry
- [ ] System uptime: ≥99% availability
```

**Вопросы для уточнения**:
- Правильно ли я оценил сроки?
- Нужны ли дополнительные задачи?
- Можем ли распараллелить какие-то задачи?
- Какие задачи критичны для MVP, какие можно отложить?

**Output**:
1. Раздел "9. Implementation Plan"
2. **TodoList через TodoWrite tool** (создать список задач для трекинга)

**Checkpoint**: ✅ План реализации согласован, TodoList создан, готовы к coding

---

### Phase 10: Визуализация (C4 Diagrams)

**Задачи**:
1. Нарисовать **C1: System Context**
   - WayMates как черный ящик
   - Внешние системы (LibreChat, OpenAI, WebSearch)
   - Протоколы взаимодействия
2. Нарисовать **C2: Containers**
   - Facade MCP, Core MCP, Neo4j, Redis
   - Связи между контейнерами
3. Нарисовать **C3: Components**
   - Компоненты внутри Facade (из Phase 5)
   - Компоненты внутри Core (если релевантно для фичи)
4. Нарисовать **Sequence Diagrams** (из Phase 3-4)
   - Ключевые сценарии из Phase 3
   - Dataflow из Phase 4

**ВАЖНО**: Диаграммы это **ВИЗУАЛИЗАЦИЯ** проработки из Phase 1-9, а не замена!

**Формат**: Mermaid diagrams

**Output**: Раздел "10. Architecture Diagrams" (C1, C2, C3, Sequence)

**Checkpoint**: ✅ Диаграммы отражают проработанную архитектуру, понятны

---

## 📁 Финальная структура документа

После завершения всех 10 фаз, `architecture.md` должен выглядеть так:

```markdown
# Feature #X: [Title] - Architecture Specification

**Дата**: YYYY-MM-DD
**Статус**: [In Design | Ready for Implementation | In Progress | Completed]
**Архитектор**: [Имя]

---

## 1. Problem Analysis
[Проблема, as-is, to-be, почему сложно]

## 2. Alternatives Analysis
[Таблица сравнения альтернатив + рекомендация]

## 3. User Scenarios
[3-5 детальных сценариев с system internals]

## 4. Dataflow Diagram
[Детальный поток данных + Mermaid diagram]

## 5. Component Interaction
[Кто кого дергает, interfaces, dependency graph]

## 6. Edge Cases
[Таблица edge cases + handling + acceptable failures]

## 7. Type Contracts
[Public API + Internal State + Component Interfaces]

## 8. Risks & Mitigations
[Таблица рисков + критичные + acceptable]

## 9. Implementation Plan
[TodoList + Definition of Done + метрики]

## 10. Architecture Diagrams
[C1, C2, C3, Sequence - визуализация]

---

## Architecture Decision Records

### ADR-XXX: [Decision Title]
**Context**: [Проблема]
**Decision**: [Решение]
**Consequences**: [Плюсы/минусы]
```

---

## ✅ Checkpoints Discipline

**Правила**:
1. После КАЖДОЙ фазы показать результат пользователю
2. Задать уточняющие вопросы через `AskUserQuestion`
3. Дождаться утверждения ✅
4. **НЕ переходить к следующей фазе без одобрения**

**Формат checkpoint**:
```
---
## Checkpoint: Phase X completed

**Deliverable**: [Что сделано]
**Questions**: [Вопросы для уточнения, если есть]

Готов переходить к Phase Y?
---
```

---

## ❌ Что НЕ делает архитектор

- ❌ **Не пишет код** до завершения всех 10 фаз
- ❌ **Не создает новые .md файлы** без явного обсуждения с пользователем
- ❌ **Не рисует диаграммы** без проработки сценариев/dataflow (Phase 3-5 ПЕРЕД Phase 10!)
- ❌ **Не перепрыгивает фазы** (строго 1→2→3→...→10)
- ❌ **Не предполагает** - всегда спрашивает через `AskUserQuestion` если неясно
- ❌ **Не смешивает уровни C4** в одном разделе (C1 отдельно, C2 отдельно, etc)
- ❌ **Не плодит документы** - один файл `architecture.md` для всей проработки

---

## 🎯 Цель команды

После выполнения `/plan-feature`:
- ✅ **Готовое ТЗ** для разработчиков (что реализовать, как тестировать)
- ✅ **TodoList** для трекинга прогресса между сессиями
- ✅ **Риски** идентифицированы и митигированы
- ✅ **Edge cases** предусмотрены
- ✅ **Type contracts** определены
- ✅ **Визуализация** (диаграммы) как бонус

**Результат**: Уверенность в подходе, детальное понимание что и как реализовывать.

---

**См. также**:
- `.claude/routers/architecture/router.md` - router для быстрой загрузки контекста
- `.claude/routers/architecture/checklist.md` - чеклист для отслеживания прогресса
- `.claude/context/project.md` - Architecture Workflow секция
