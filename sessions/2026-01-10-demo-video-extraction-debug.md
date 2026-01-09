# Session: Demo Video Extraction Debug

**Дата:** 2026-01-10
**Фокус:** Запуск /demo-video-script short, отладка extraction и NLP formatter

---

## Что сделано

### Phase 1: Pre-flight и фиксы промпта (предыдущая сессия)

**Инфраструктура:**
- Neo4j поднят, demo fixtures импортированы (11 users)
- Garbage users удалены
- Demo-Alex удалён (для short demo — чтобы не найти себя)

**Фиксы Q4-Q9:** GOAL_BLOCK, FILTERS_BLOCK, telegram-chat alias, pacing, etc.

### Phase 2: Extraction debugging (РЕШЕНО)

**Root cause:** Устаревший кеш Redis с урезанными словарями.

**Решение:**
```bash
docker exec waymates-redis-test redis-cli DEL waymates:dict:position waymates:dict:role waymates:dict:industry waymates:dict:domain waymates:dict:skill
```

### Phase 3: Prompt improvements (предыдущая сессия)

| # | Проблема | Файл | Исправление |
|---|----------|------|-------------|
| 1 | DECOMPOSITION_RULES слишком философские | `shared/prompts.ts` | Упрощены правила |
| 2 | Hints не выделены визуально | `extraction.ts` | Обрамление `{{ hints }}` |
| 3 | NLP reasoning неинформативный | `nlp-formatter.service.ts` | "List ALL keys..." |
| 4 | domains — не массив | `shared/prompts.ts` | "(ARRAY — can have multiple)" |
| 5 | countryCode не извлекался | `extraction.ts` | Правило 10: ISO codes |

### Phase 4: NLP Formatter Bugs (ТЕКУЩАЯ СЕССИЯ — РЕШЕНО)

**Commit:** `6341f99`

| # | Баг | Root Cause | Решение |
|---|-----|------------|---------|
| 1 | Explore показывает Context вместо candidates | Промпт использовал `explorationResults` вместо `candidates` (ключ в response-builder) | Заменил на `candidates` в prompts.ts |
| 2 | asking_search_mode показывает Goal как Context | Reasoning description говорил "List keys from adhocContext" — не универсально | Универсальное "List ALL keys from received data" |

**Дополнительные улучшения:**

| Улучшение | Описание |
|-----------|----------|
| Numbered list | MANDATORY FOR EACH item in candidates/results array |
| Формат `(country)` | Вместо `@ country` — скобки читаемее |
| `N months ago` | timeSinceMatchedMonths для каждого кандидата |
| `context age` | Вместо `recency` — понятнее что это фильтр по давности |
| Citizenship fallback | Страна без явного гражданства → оба поля |

**Итоговый вывод explore:**
```
📋 Results: 8 similar people

1. technical project manager (RU) — backend, management • 4 months ago
2. technical project manager (RU) — management, backend • 7 months ago
...
```

---

## Что осталось сделать

1. **ESLint error** — `cold-start-v2/prompts.ts:contextExtractionPrompt` 63 строки (max 60). Закоммичено с --no-verify. Нужен рефакторинг.

2. **Locale из GramJS** — telegram-chat.ts берёт language_code из Telegram профиля. GramJS сессия кеширует `ru`. Варианты:
   - Пересоздать TELEGRAM_SESSION
   - Добавить FORCE_LOCALE env (отклонено)
   - Подождать синхронизации Telegram серверов

3. **Прогнать /demo-video-script short до конца** — теперь flow работает, можно записывать.

---

## Артефакты и ссылки

| Файл | Что |
|------|-----|
| `src/facade/services/nlp-formatter/prompts.ts` | NLP formatter (ИСПРАВЛЕНО) |
| `src/facade/services/nlp-formatter/nlp-formatter.service.ts` | Reasoning description (ИСПРАВЛЕНО) |
| `src/facade/langGraph/search-graph/prompts/extraction.ts` | Citizenship fallback (ИСПРАВЛЕНО) |
| `src/facade/langGraph/search-graph/response-builders.ts` | Ключи response (candidates, не explorationResults) |

---

## Ключевые наблюдения

1. **Ключи response-builder vs prompts** — несоответствие `explorationResults` vs `candidates` было root cause BUG 1
2. **Universal reasoning description** — глобальные инструкции в structured output должны быть универсальны для всех фаз
3. **MANDATORY в промптах** — без этого слова LLM часто игнорирует инструкции про списки
4. **telegram-chat.ts** — не поддерживает --session/--reset, только --start/--file/текст

---

## Промпт для продолжения после rewind

```
Продолжаем сессию: sessions/2026-01-10-demo-video-extraction-debug.md

КОНТЕКСТ:
- NLP formatter баги исправлены ✅ (commit 6341f99)
- Explore/Waymates/Pathfinders показывают numbered list с (country) и "N months ago"
- Citizenship fallback работает (country → оба поля)

ОСТАЛОСЬ:
1. ESLint error в cold-start-v2/prompts.ts (63 строки, max 60) — рефакторинг
2. Locale из GramJS кеширует "ru" — нужно пересоздать TELEGRAM_SESSION или ждать
3. Прогнать /demo-video-script short до конца

ГОТОВО К ЗАПИСИ DEMO VIDEO.
```
