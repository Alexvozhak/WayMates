# E2E Dialog Analysis — LLM-as-User Test

**Дата:** 2025-12-12
**Тест:** `poc/e2e-variant2-llm-user-prod.ts`
**Персона:** Backend Developer (Яндекс) → ML Engineer

---

## Лог диалога с комментариями

### Exchange 1: /start
```
→ USER: /start
← BOT:  Привет, Алексей! Рад видеть тебя на платформе WayMates. Мы помогаем на...
```
✅ **OK** — приветствие работает, язык RU

---

### Exchange 2: /story
```
→ USER: /story
← BOT:  Tell me about your career history:
        For example:
        Worked as a backend developer at Yandex from 2020 to 2023...
```
⚠️ **ПРОБЛЕМА: Язык EN вместо RU**
- `story-prompt` в `ru.ftl` на русском, но бот ответил на английском
- **Проверить:** WelcomePresenter отработал на RU, а тут EN — почему?
- **Гипотеза:** `story-prompt` идёт через i18n (`ctx.t`), но locale не определился?

---

### Exchange 3: История пользователя (КРИТИЧЕСКИЙ БАГ)
```
→ USER: Я работаю бэкенд-разработчиком в Яндексе с 2020 года, занимаюсь Python
        и FastAPI. Уверенно использую PostgreSQL и имею опыт в машинном обучении,
        прошел курс на Coursera и сделал два pet-проекта в области компьютерного зрения.

← BOT:  Tell me about your career history. 📝
        I'm here to listen and gather all the details about your journey.
```
🔴 **КРИТИЧЕСКИЙ БАГ: Бот ИГНОРИРУЕТ ввод и повторяет промпт**

**Что должно было произойти:**
1. `pendingAction = "story"` установлен после `/story`
2. Свободный текст → `input-router` → `handleStoryWithText`
3. История отправляется в `cold_start` agent

**Что произошло:**
- Бот НЕ обработал историю
- Вернул тот же промпт (на EN с emoji 📝 — откуда?)
- **Проверить:**
  - Сохранился ли `pendingAction` в Redis?
  - Не сбросился ли session между сообщениями?
  - Откуда текст "I'm here to listen..." — это НЕ из `ru.ftl`!

**Гипотеза:** LLM presenter генерирует свой текст вместо использования locale

---

### Exchange 4: Повторная попытка (тот же баг)
```
→ USER: Я работаю бэкенд-разработчиком в Яндексе с 2020 года... (повтор истории)

← BOT:  Сначала выберите действие:
        /story — Рассказать карьерную историю
        /by_target — Поиск по целевой позиции
        /by_current — Поиск по моему профилю
```
🔴 **БАГ: `action-required` fallback**

**Анализ:**
- Бот вернул `action-required` из `ru.ftl` — значит `pendingAction = undefined`
- `pendingAction` был ПОТЕРЯН между exchange 2 и 4
- **Проверить:**
  - Redis session TTL
  - `clearPendingAction` вызывается где-то неожиданно?
  - Session key коллизия?

---

### Exchange 5: /by_target
```
→ USER: /by_target
← BOT:  Поиск по целевой позиции
        Опишите кем хотите стать:
        /by_target Senior ML Engineer в финтехе
```
✅ **OK** — команда работает, язык RU

---

### Exchange 6: Запрос поиска
```
→ USER: Хочу стать ML Engineer, работающим в области компьютерного зрения.
← BOT:  It looks like I couldn't find any specific career paths for you at the...
```
⚠️ **ПРОБЛЕМЫ:**
1. **Язык EN** — SearchPresenter игнорирует locale
2. **Нет результатов** — база пустая или поиск сломан

**Проверить:**
- `search_by_target` MCP tool работает?
- Есть ли данные в Neo4j для поиска?
- SearchPresenter передаёт язык в LLM?

---

### Exchange 7-8: Повторные запросы
```
→ USER: Я интересуюсь углубленным изучением компьютерного зрения...
← BOT:  It looks like there are no specific career paths matching your criteria

→ USER: Мне интересно узнать, какие курсы или ресурсы...
← BOT:  (timeout)
```
⚠️ **Бот не понимает контекст** — отвечает шаблонно "no results"

---

## Сводка проблем

| # | Проблема | Severity | Категория |
|---|----------|----------|-----------|
| 1 | `pendingAction` теряется между сообщениями | 🔴 Critical | Session/State |
| 2 | Язык скачет EN/RU | 🟡 Medium | i18n/Presenters |
| 3 | Presenter генерирует свой текст вместо locale | 🟡 Medium | LLM Prompts |
| 4 | Нет результатов поиска | 🟡 Medium | Data/Search |
| 5 | Бот не понимает свободный текст без команды | 🟡 Medium | UX/Intent |

---

## Что проверить

### 1. Session/PendingAction
```bash
# Проверить Redis во время теста
redis-cli -p 6380 KEYS "*"
redis-cli -p 6380 GET "session:<user_id>"
```

### 2. Логи бота
```bash
# Запустить с debug
LOG_LEVEL=debug npx tsx --env-file=.env.test src/telegram-bot/index.ts
```
Искать:
- `setPendingAction` / `clearPendingAction` вызовы
- `routeInput` — какой pendingAction видит?

### 3. Presenters
- `WelcomePresenter` — почему работает на RU?
- `story-prompt` — это i18n или LLM?
- `SearchPresenter` — передаётся ли `language_code`?

### 4. Откуда "I'm here to listen..."
Этот текст НЕ из locale файлов. Варианты:
- LangGraph agent генерирует
- Presenter галлюцинирует
- Где-то hardcoded fallback

---

## UX проблема (корневая)

Даже если пофиксить баги выше, остаётся главная проблема:

**Пользователь должен выбирать технические команды:**
- `/by_target` — непонятно что это
- `/by_adhoc` — ещё менее понятно
- `/by_current` — requires story first

**Желаемое поведение:**
1. Пользователь пишет свободный текст
2. LLM определяет intent (story / search / goal)
3. Бот предлагает режим и объясняет что будет
4. Пользователь подтверждает или меняет

---

## Next Steps

1. [ ] Пофиксить `pendingAction` потерю (critical)
2. [ ] Разобраться с языком в Presenters
3. [ ] Найти источник "I'm here to listen..."
4. [ ] Дизайн intent detection UX
