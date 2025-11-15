# Add CRUD endpoints for Context/Trail management

**Component**: Core Manager, Core MCP

**Priority**: 🔴 P0

---

## User Story

Как Facade разработчик, я хочу чтобы Core предоставлял CRUD операции для Contexts и Trails, чтобы реализовывать функции редактирования пользовательской истории (update_context, delete_context) без написания кастомных Cypher запросов в Facade.

---

## AS IS

Core имеет только массовые операции: `upsertStory(fullStory)`, `import_story(batch)`. Нет гранулярного CRUD: нельзя обновить отдельный контекст, нельзя удалить контекст, нельзя добавить standalone контекст без полной перезагрузки истории.

---

## TO BE

Core Manager CRUD методы: `updateContext(contextId, updates)`, `deleteContext(contextId)`, `createContext(data)`, `updateTrail(trailId, updates)`, `deleteTrail(trailId)`. Выставлены через Core MCP инструменты. Валидация, auth hooks (проверка userId), транзакционная безопасность. Facade может строить UI редактирования истории поверх Core CRUD примитивов.
