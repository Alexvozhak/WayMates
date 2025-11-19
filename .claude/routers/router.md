# Knowledge Router - Навигация по модулям знаний

**Назначение**: Определить, какой модуль знаний загрузить для конкретной задачи.

---

## Self-Awareness для LLM

**CRITICAL**: После завершения работы с модулем **ВСЕГДА**:
1. Предложи пользователю: "Запустить `/reflect [module]`?"
2. Если есть очевидные улучшения → дай **короткие рекомендации** с объяснением пользы:
   - Формат: "Рекомендация - чем поможет"
   - Пример: "Добавить в FAQ 'searchAdhoc 0 results' - сократит время поиска при повторном баге"
   - Пример: "Обновить mistakes-registry #3 - предотвратит повторение WITH scope ошибки"
   - Пример: "Нет рекомендаций - документация покрыла все проблемы"

**Команды**: `/reflect cypher`, `/reflect qa`, `/reflect eslint`, `/reflect langgraph`

**Самоанализ в `/reflect`**:
- Что пошло не так при навигации?
- Какой информации не хватило?
- Как улучшить промпт/документацию?

---

## Модули знаний

### 🔧 Cypher (Neo4j Queries)
**Роутер**: [cypher/router.md](cypher/router.md)

**Когда загружать**:
- Пишешь/модифицируешь Cypher query
- Фиксишь баг в Cypher query
- Рефакторишь query builder
- Оптимизируешь query (PROFILE)
- Изменяешь Neo4j schema
- Работаешь с scoring logic / aggregations
- Работаешь с DTW / trajectory queries

**После работы**: `/reflect cypher`

---

### 🧪 QA (Test Quality & Coverage)
**Роутер**: knowledge/qa/router.md *(planned)*

**Когда загружать**:
- Пишешь новые тесты
- Фиксишь failing tests
- Анализируешь test coverage
- Улучшаешь test quality
- Проверяешь test assertions (coverage theater?)

**После работы**: `/reflect qa`

---

### 📏 ESLint (Code Style & Simplicity)
**Конфиг**: `eslint.config.mjs` (source of truth для всех правил)

**Когда читать конфиг**:
- ESLint ошибки (правила в строках 22-206)
- Настройка новых правил
- Понять почему что-то запрещено

**Ключевые категории**:
- Naming (строки 22-60): camelCase, PascalCase
- Type safety (132-173): no any, explicit return types
- Simplicity (175-184): max-depth: 2, complexity: 8, max-lines: 60
- Imports (93-131): порядок, no default export, extensions
- Relaxed для тестов (210-217)

**После работы**: `/reflect eslint`

---

### 🤖 LangChain v1.0 (Agent Framework)
**Роутер**: [langchain/router.md](langchain/router.md)

**Когда загружать**:
- Создаешь агентов через `createAgent` API
- Мигрируешь с LangGraph на createAgent
- Настраиваешь Gemini провайдер
- Добавляешь tools, middleware, persistence
- Реализуешь human-in-the-loop workflows
- Работаешь с PostgresSaver для checkpoints
- Управляешь state через stateSchema
- Настраиваешь parallel tool execution

**После работы**: `/reflect langchain`
