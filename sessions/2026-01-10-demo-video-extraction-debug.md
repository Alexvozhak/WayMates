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

### Phase 2: Extraction debugging (РЕШЕНО ✅)

**Root cause:** Устаревший кеш Redis с урезанными словарями.

**Решение:**
```bash
docker exec waymates-redis-test redis-cli DEL waymates:dict:position waymates:dict:role waymates:dict:industry waymates:dict:domain waymates:dict:skill
```

### Phase 3: Prompt improvements (текущая сессия)

**Сделано:**

| # | Проблема | Файл | Исправление |
|---|----------|------|-------------|
| 1 | DECOMPOSITION_RULES слишком философские | `shared/prompts.ts` | Упрощены правила, убрано "seniority level" |
| 2 | Hints не выделены визуально | `search-graph/prompts/extraction.ts` | Обрамление `{{ hints }}` в двойные скобки |
| 3 | LLM не видит связь "map to KNOWN X" → hints | `shared/prompts.ts` | Все ссылки `{{KNOWN POSITIONS}}` etc. |
| 4 | NLP formatter пропускал поля | `nlp-formatter/prompts.ts` | "list EVERY key from adhocContext" |
| 5 | NLP reasoning неинформативный | `nlp-formatter.service.ts` | "List ALL keys... explain which included" |
| 6 | domains — не массив | `shared/prompts.ts` | "(ARRAY — can have multiple values)" |
| 7 | countryCode не извлекался | `extraction.ts` | Правило 10: convert country names to ISO |
| 8 | Проверка кеша не в инструкциях | `manual-test-debug.md`, `demo-video-script.md` | Добавлена проверка Redis dict cache |
| 9 | EDUCATION_LEVELS vs EDUCATION LEVELS | `dictionaries.service.ts` | Унифицировано с пробелом |

**Extraction теперь работает:**
```
✅ Position level: technical project manager
✅ Professional role: manager
✅ Work domains: management, backend
✅ Industry: fintech
✅ Country: RU
✅ Citizenship: RU
```

---

## Что осталось сделать (ДВА БАГА)

### BUG 1: NLP formatter показывает Context вместо Exploration results

**Симптом:** После "Let's explore" бот показывает Context вместо кандидатов.

**Логи:**
- `explore` node вернул `explorationResults: [8 items]` + `chartUrl` ✅
- `phase: showing_exploration_candidates` ✅
- NLP formatter вывел Context! ❌

**NLP reasoning:**
```
"The keys from adhocContext I received are: position, role, domains..."
```

**Проблема:** NLP formatter смотрит на `adhocContext` вместо `explorationResults` в фазе `showing_exploration_candidates`.

**Где искать:** `nlp-formatter/prompts.ts`, секция `SEARCH_PHASE.showing_exploration_candidates`

### BUG 2: Goal отображается как Context

**Симптом:** После "Save it" (goal) бот показывает Goal поля с заголовком Context.

**Логи:**
```
phase: asking_search_mode
reasoning: "The keys from adhocContext that I received are: position, role, countries, domains..."
```

**Проблема:** NLP formatter в `asking_search_mode` показывает goal как context.

**Где искать:** `nlp-formatter/prompts.ts`, секция `SEARCH_PHASE.asking_search_mode`

---

## Артефакты и ссылки

| Файл | Что |
|------|-----|
| `src/facade/services/nlp-formatter/prompts.ts` | NLP formatter (ОБА БАГА ЗДЕСЬ) |
| `src/facade/langGraph/shared/prompts.ts` | DECOMPOSITION_RULES (исправлено) |
| `src/facade/langGraph/search-graph/prompts/extraction.ts` | Extraction prompt (исправлено) |

---

## Ключевые наблюдения

1. **Кеш Redis — частая причина проблем extraction** — всегда проверять перед отладкой
2. **{{ }} обрамление hints** помогает LLM связать описание с конкретным списком
3. **NLP formatter reasoning** — ключ к пониманию почему вывод неправильный
4. **gpt-4o-mini работает** когда промпты правильные — не нужна дорогая модель

---

## Промпт для продолжения после rewind

```
Продолжаем сессию: sessions/2026-01-10-demo-video-extraction-debug.md

КОНТЕКСТ:
- Extraction исправлен и работает ✅
- /demo-video-script short запущен, но два бага в NLP formatter

ДВА БАГА (оба в nlp-formatter/prompts.ts):

BUG 1: showing_exploration_candidates
- После "Let's explore" показывает Context вместо explorationResults
- NLP смотрит на adhocContext вместо explorationResults
- Логи: explore вернул 8 results + chartUrl, но NLP их не показал

BUG 2: asking_search_mode
- После "Save it" (goal) показывает Goal как Context
- NLP reasoning: "keys from adhocContext: position, role, countries..."
- Должен показывать Goal отдельно, предлагать pathfinders/waymates

TODO:
1. Исправить NLP formatter для showing_exploration_candidates
2. Исправить NLP formatter для asking_search_mode
3. Прогнать /demo-video-script short до конца
```
