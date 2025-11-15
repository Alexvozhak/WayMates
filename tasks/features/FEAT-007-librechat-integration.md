# LibreChat integration (system prompts, config)

**Component**: Client integration

**Priority**: 🔴 P0

---

## User Story

Как пользователь, я хочу взаимодействовать с WayMates через чат-интерфейс LibreChat, чтобы искать карьеры, добавлять свою историю и получать рекомендации в разговорной форме.

---

## AS IS

Нет клиентской интеграции. WayMates Core/Facade - бэкенд-сервисы без пользовательского интерфейса. Пользователи не могут взаимодействовать с системой.

---

## TO BE

LibreChat интеграция настроена: системные промпты для use case WayMates, зарегистрированы MCP инструменты (search_careers, add_experience, get_story, set_goal), auth middleware (инъекция userId), UI конфигурация (брендинг, приветственное сообщение). Пользователи получают чат-интерфейс для исследования карьер и сбора данных.

**Зависимости**: Facade MCP (FEAT-005), LangGraph workflows (FEAT-006)
