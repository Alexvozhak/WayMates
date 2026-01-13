# FEAT-047: Structurizr Cloud Integration

**Статус:** PENDING
**Приоритет:** P1
**Компонент:** Facade / Documentary
**Зависимости:** DocumentaryService (готов)

---

## Контекст

Нужно интегрировать Structurizr Cloud для публикации C4 диаграмм в портфолио. Documentary MCP tools должны возвращать ссылки на интерактивные архитектурные диаграммы.

### Текущее состояние

| Компонент | Статус |
|-----------|--------|
| `DocumentaryService` | ✅ Реализован |
| `investor.md`, `tech.md`, `user.md` | ✅ Placeholder `XXXX` |
| `workspace.json` | ✅ 10 views |
| MCP tools registration | ❌ Не сделано |
| Structurizr env vars | ❌ Не добавлены |
| Structurizr Cloud account | ❌ Не создан |

---

## Требования

### Функциональные

1. **Env конфигурация**
   - `STRUCTURIZR_WORKSPACE_ID` — ID workspace в облаке
   - `STRUCTURIZR_SHARE_TOKEN` — токен для публичного доступа
   - Опциональные — graceful fallback если не заданы

2. **StructurizrConfigService**
   - Генерация URL для конкретного view
   - Маппинг views по аудиториям (investor, tech, user)
   - Форматирование markdown списка диаграмм

3. **MCP Tools Registration**
   - `get_investor_pitch` — бизнес pitch + 2 диаграммы (L1, L2)
   - `get_tech_overview` — техническое описание + 8 диаграмм
   - `get_user_info` — пользовательское описание + 1 диаграмма

4. **URL формат**
   ```
   https://structurizr.com/share/<token>?view=<viewKey>
   ```

### Нефункциональные

- Graceful degradation если Structurizr не настроен
- Тесты для URL генерации и fallback
- Документация настройки

---

## Views маппинг

| View Key | Label | Investor | Tech | User |
|----------|-------|----------|------|------|
| `L1-SystemContext` | System Context | ✅ | ✅ | ✅ |
| `L2-Containers` | Container Architecture | ✅ | ✅ | |
| `L3-Facade-Components` | Facade Components | | ✅ | |
| `L3-Core-Components` | Core Components | | ✅ | |
| `ColdStart-Flow` | Cold Start Flow | | ✅ | |
| `Search-Flow` | Search Flow | | ✅ | |
| `GoalCreation-Flow` | Goal Creation Flow | | ✅ | |
| `L4-SearchFromCurrent-Flowchart` | Search Algorithm | | ✅ | |
| `L4-SearchToTarget-Flowchart` | Target Search | | ✅ | |
| `L4-Classes` | Class Diagram | | ✅ | |

---

## План реализации

### Фаза 1: Configuration (15 мин)

- [ ] Добавить env vars в `src/facade/env.ts`
- [ ] Добавить в `.env.example`

### Фаза 2: Service Layer (30 мин)

- [ ] Создать `src/facade/services/structurizr-config.service.ts`
- [ ] Методы: `getViewsForAudience()`, `getViewUrl()`, `formatDiagramsMarkdown()`
- [ ] Unit тесты

### Фаза 3: MCP Tools (45 мин)

- [ ] Зарегистрировать `get_investor_pitch` в `mcp-server.ts`
- [ ] Зарегистрировать `get_tech_overview`
- [ ] Зарегистрировать `get_user_info`
- [ ] Добавить diagram links в ответы

### Фаза 4: Structurizr Cloud Setup (20 мин)

- [ ] Регистрация на structurizr.com
- [ ] Upload `workspace.json`
- [ ] Получить share token
- [ ] Заполнить `.env`

### Фаза 5: Testing (30 мин)

- [ ] Unit тесты StructurizrConfigService
- [ ] Integration тесты MCP tools
- [ ] Manual test в Telegram

---

## Открытые вопросы

### Q1: Бюджет Structurizr Cloud

**Варианты:**
- A) Paid (~$10-15/мес) — профессиональные sharing links
- B) Lite + PNG export — бесплатно, статичные картинки

**Рекомендация:** A — для портфолио важна интерактивность

---

### Q2: Расположение ссылок на диаграммы

**Варианты:**
- A) В конце каждого ответа (отдельная секция "Architecture Diagrams")
- B) Inline в тексте ответа (LLM сам решает где вставить)
- C) Только если пользователь спросил про архитектуру

**Рекомендация:** A — предсказуемо, не зависит от LLM

---

### Q3: Intent classification для documentary

**Варианты:**
- A) Добавить PROJECT_INFO intents, автоматический роутинг
- B) Только явный вызов tools (через Telegram команды)

**Рекомендация:** B для MVP, A позже

---

### Q4: Обновление placeholder в MD файлах

**Варианты:**
- A) Заменить `XXXX` на реальные ссылки в MD файлах
- B) Генерировать ссылки динамически в service (текущий план)

**Рекомендация:** B — single source of truth в env vars

---

### Q5: Аккаунт Structurizr

**Нужно от пользователя:**
- Email для регистрации
- Карта для оплаты (~$10-15/мес)
- Или решение использовать free alternative

---

## Файлы

### Создать

| Файл | LOC | Описание |
|------|-----|----------|
| `src/facade/services/structurizr-config.service.ts` | ~120 | URL builder |
| `tests/facade/services/unit/structurizr-config.spec.ts` | ~80 | Тесты |

### Изменить

| Файл | Изменения |
|------|-----------|
| `src/facade/env.ts` | +2 env vars |
| `src/facade/mcp-server/mcp-server.ts` | +3 tools, ~100 LOC |
| `.env.example` | +2 строки |

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Время реализации | 2.5-3 часа |
| Сложность | Низкая |
| Риски | Платный сервис |

---

## Связанные документы

- [RES-structurizr-cloud.md](../../docs/business/research/RES-structurizr-cloud.md)
- [STRATEGIC-DECISIONS.md](../../docs/business/STRATEGIC-DECISIONS.md) — SD-004
- [workspace.json](../../docs/architecture/workspace.json)
