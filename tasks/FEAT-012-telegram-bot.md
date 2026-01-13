# Telegram Bot Service (Node.js + Telegraf)

**Component**: Client integration

**Priority**: 🟢 P2

---

## User Story

Как мобильный пользователь, я хочу взаимодействовать с WayMates через Telegram, чтобы искать карьеры и добавлять свою историю без открытия веб-браузера.

---

## AS IS

Только веб-интерфейс LibreChat. Нет мобильно-ориентированного клиента. Пользователи должны использовать десктопный браузер для взаимодействия с WayMates.

---

## TO BE

Telegram bot сервис: Node.js + Telegraf фреймворк, вебхуки для обработки сообщений, интеграция с Facade MCP (инструменты search_careers, add_experience, get_story), авторизация через Telegram userId, разговорный UX оптимизированный для мобильных. Пользователи могут взаимодействовать с WayMates с любого мобильного устройства через Telegram приложение.
