# Planka Quick Start Guide

Полное руководство по настройке Planka локально + MCP сервер (kanban-mcp) для интеграции с Claude Code.

---

## 🚀 Шаг 1: Запустить Planka через Docker

### 1.1 Создать конфигурацию

```bash
# Скопировать шаблон переменных
cp .env.planka.example .env.planka

# Сгенерировать SECRET_KEY (минимум 32 символа)
openssl rand -hex 32
# Или через Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Отредактировать .env.planka
nano .env.planka
```

**Обязательно измени**:
- `PLANKA_SECRET_KEY` - вставь сгенерированный ключ
- `PLANKA_DB_PASSWORD` - любой сильный пароль
- `PLANKA_ADMIN_EMAIL` - email администратора (default: admin@planka.local)
- `PLANKA_ADMIN_PASSWORD` - пароль администратора (default: admin123)

### 1.2 Запустить Planka

```bash
# Запустить оба сервиса
docker-compose -f docker-compose.planka.yml --env-file .env.planka up -d

# Проверить статус
docker-compose -f docker-compose.planka.yml ps

# Логи (если что-то не работает)
docker-compose -f docker-compose.planka.yml logs -f planka
```

### 1.3 Дождаться готовности

Planka будет доступен через **30-60 секунд** на:

```
http://localhost:3000
```

**Упрощённая конфигурация** (host network, VPN-friendly):
- Только **2 сервиса** (planka + postgres) вместо 6 у Plane!
- Кастомные порты чтобы не конфликтовать с WayMates и Plane:
  - PostgreSQL: 5434 (не 5432)
  - Planka Web: 3000 (не 3080 как у Plane)

---

## 👤 Шаг 2: Первый вход в UI

### 2.1 Войти как администратор

1. Открой http://localhost:3000
2. Нажми **"Log in"**
3. Введи credentials из `.env.planka`:
   - Email: `admin@planka.local` (или твой кастомный)
   - Password: `admin123` (или твой кастомный)
4. Нажми **"Log in"**

### 2.2 Создать первый проект

1. Нажми **"Create new project"** или **"+"**
2. Название проекта: **"WayMates"**
3. Выбери фон (опционально)
4. Нажми **"Create"**

### 2.3 Настроить доску

По умолчанию создаётся пустой проект. Добавь списки (columns):

1. Нажми **"+ Add another list"**
2. Создай списки:
   - **Backlog**
   - **Todo**
   - **In Progress**
   - **Review**
   - **Done**

### 2.4 Создать первую карточку

1. В списке **"Todo"** нажми **"+ Add card"**
2. Введи название: **"Настроить интеграцию Planka + Claude Code"**
3. Нажми **Enter**
4. Кликни на карточку чтобы открыть детали
5. Добавь описание (поддерживает **Markdown**!):

```markdown
## Задача

Проверить что MCP сервер kanban-mcp работает с Planka.

## Критерии приемки

- [ ] Docker контейнеры запущены
- [ ] Planka доступна на http://localhost:3000
- [ ] MCP сервер подключён в Claude Code
- [ ] Можно создавать карточки через Claude

## Тестирование

Команда в Claude Code:
```
Создай карточку: протестировать Planka markdown
```
```

---

## 🤖 Шаг 3: Настроить MCP сервер (kanban-mcp)

### 3.1 MCP сервер уже установлен!

kanban-mcp уже склонирован и собран в:
```
~/projects/planka-kanban-mcp/
```

### 3.2 Настроить Claude Code

MCP сервер уже добавлен в `.mcp.json` проекта:

```json
{
  "mcpServers": {
    "planka": {
      "command": "node",
      "args": ["/home/alex/projects/planka-kanban-mcp/dist/index.js"],
      "env": {
        "PLANKA_BASE_URL": "http://localhost:3000",
        "PLANKA_AGENT_EMAIL": "admin@planka.local",
        "PLANKA_AGENT_PASSWORD": "admin123"
      }
    }
  }
}
```

**Важно**: Если ты изменил email/password администратора в `.env.planka`, обнови их в `.mcp.json`!

### 3.3 Перезапустить Claude Code

```bash
# В VSCode:
# Command Palette (Cmd+Shift+P) → "Developer: Reload Window"
```

### 3.4 Проверить MCP сервер

В чате Claude Code:

```
Покажи все проекты в Planka
```

Claude должен использовать `mcp__planka__list_projects` и вывести:
```
✅ Найден проект: WayMates
```

---

## 📋 Шаг 4: Создать первую задачу через Claude

### Через естественный язык

```
Создай карточку в Planka:
- Проект: WayMates
- Список: Todo
- Название: Написать unit тесты для SearchManager
- Описание: Добавить тесты для всех публичных методов
```

Claude должен:
1. Найти проект "WayMates"
2. Найти список "Todo"
3. Создать карточку
4. Вывести прямую ссылку

---

## 🧪 Шаг 5: Проверить интеграцию

### Тестовые команды

```bash
# 1. Список проектов
"Покажи все мои проекты в Planka"

# 2. Список карточек
"Покажи все карточки в проекте WayMates"

# 3. Создать карточку
"Создай карточку: Оптимизировать DTW алгоритм"

# 4. Переместить карточку
"Перемести карточку 'Настроить интеграцию' в In Progress"

# 5. Добавить комментарий
"Добавь комментарий к карточке: начал работу над оптимизацией"

# 6. Time tracking
"Запусти таймер на карточке 'Оптимизировать DTW'"
```

---

## 🔧 Troubleshooting

### Planka не стартует

```bash
# Проверить логи
docker-compose -f docker-compose.planka.yml logs planka

# Типичные проблемы:
# 1. SECRET_KEY слишком короткий → измени в .env.planka (минимум 32 символа)
# 2. Порт 3000 занят → измени PORT в docker-compose.planka.yml
# 3. PostgreSQL не стартует → проверь логи postgres
```

### База данных не подключается

```bash
# Проверь что PostgreSQL запущен
docker-compose -f docker-compose.planka.yml ps planka-postgres

# Проверь healthcheck
docker-compose -f docker-compose.planka.yml logs planka-postgres | grep healthy

# Если ошибка подключения → проверь DATABASE_URL в docker-compose.planka.yml
```

### MCP сервер не подключается

```bash
# Проверь .mcp.json:
# 1. Путь к index.js правильный: /home/alex/projects/planka-kanban-mcp/dist/index.js
# 2. PLANKA_BASE_URL = http://localhost:3000
# 3. Credentials совпадают с .env.planka

# Перезапусти Claude Code
# Cmd+Shift+P → "Developer: Reload Window"

# Проверь что Planka запущена
curl http://localhost:3000
```

### Не могу войти в Planka

```bash
# Проверь DEFAULT_ADMIN_EMAIL и DEFAULT_ADMIN_PASSWORD в .env.planka
cat .env.planka | grep ADMIN

# Пересоздай контейнеры (сбросит admin пароль)
docker-compose -f docker-compose.planka.yml down -v
docker-compose -f docker-compose.planka.yml --env-file .env.planka up -d
```

### Markdown не отображается

Planka поддерживает **Rich Markdown** в описаниях карточек и комментариях. Если не работает:

1. Обнови до последней версии: `docker pull ghcr.io/plankanban/planka:latest`
2. Пересоздай контейнеры: `docker-compose -f docker-compose.planka.yml up -d --force-recreate`

---

## 📚 Полезные ссылки

### Planka
- Web UI: http://localhost:3000
- Official Docs: https://docs.planka.cloud/
- GitHub: https://github.com/plankanban/planka
- Demo: https://plankanban.github.io/planka/ (online demo)

### MCP Server (kanban-mcp)
- GitHub: https://github.com/bradrisse/kanban-mcp
- Local path: ~/projects/planka-kanban-mcp/
- Stars: 34⭐ (active community)

### Workflows
- Quick Start: `PLANKA-START.md`
- API Reference: See kanban-mcp GitHub for available tools

---

## 🎯 Следующие шаги

После успешной настройки:

1. **Создать структуру проекта**
   - Добавить метки (labels): bug, feature, enhancement, documentation
   - Настроить цвета меток
   - Добавить участников (members) если работаешь в команде

2. **Импорт задач из Vikunja/Focalboard** (опционально)
   - Экспортировать задачи из старых систем
   - Импортировать в Planka через UI или API

3. **Использовать в работе**
   - Natural language команды в Claude Code
   - Kanban доска для drag & drop
   - Time tracking для метрик
   - Markdown в описаниях для детального контекста

4. **Интеграция с GitHub** (опционально)
   - Референсы на карточки в коммитах: "Fixes #CARD-123"
   - Автоматическое обновление статусов

---

## 🆚 Сравнение с Plane и Vikunja

| Критерий | Planka | Plane | Vikunja |
|----------|--------|-------|---------|
| **Сервисы** | 🏆 **2** | 6 | 3 |
| **Markdown** | ✅ Rich | ✅ Full | ❌ Plain text |
| **MCP сервер** | ✅ kanban-mcp (34⭐) | ✅ Official | ✅ Community |
| **Лицензия** | AGPL-3.0 | AGPL-3.0 | AGPL-3.0 |
| **Setup Time** | < 1 min | ~2 min | ~1 min |
| **Memory** | ~200 MB | ~500 MB | ~150 MB |
| **Complexity** | 🏆 **Простой** | Сложный | Простой |
| **Features** | Kanban, Time tracking | Kanban, Cycles, Wiki | Lists, Kanban |
| **API** | REST | REST (богатый) | REST |
| **UI** | Modern | Professional | Basic |

**Вердикт**: Planka - золотая середина между простотой Vikunja и функциональностью Plane.

---

**Готово! 🎉 Planka настроен и интегрирован с Claude Code.**

Используй natural language команды в Claude Code для управления задачами!
