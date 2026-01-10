# Session: Demo Video Extraction Debug

**Дата:** 2026-01-10
**Фокус:** Запуск /demo-video-script short + long, отладка extraction и NLP formatter

---

## Что сделано

### Phase 1-3: Pre-flight, extraction, prompt improvements (предыдущие сессии)

- Инфра поднята, demo fixtures загружены (11 users)
- Redis dict cache исправлен
- NLP prompts улучшены (hints, reasoning, arrays)

### Phase 4: NLP Formatter Bugs (commit 6341f99)

| Баг | Root Cause | Решение |
|-----|------------|---------|
| Explore показывает Context | `explorationResults` vs `candidates` | Заменил на `candidates` |
| asking_search_mode показывает Goal как Context | Reasoning description не универсально | "List ALL keys from received data" |

**Улучшения:** numbered list, `(country)` формат, `N months ago`, citizenship fallback.

### Phase 5: Demo Video Recording (ТЕКУЩАЯ СЕССИЯ)

**Short demo выполнен:**
- Adhoc context extraction ✅
- Explore (8 candidates) ✅
- Goal extraction + save ✅
- Pathfinders (3 results) ✅
- Waymates (5 results) ✅
- Advisor questions ✅

**Long demo выполнен:**
- CV upload → 3 positions extracted ✅
- Position clarification flow ✅
- Profile saved ✅
- DTW pathfinders search ✅
- Advisor with DTW analysis ✅

### Phase 6: Bugs Discovery (13 багов найдено)

Полный список в `sessions/2026-01-10-demo-bugs-plan.md`

### Phase 7: Bug Fixes (ВСЕ 12 багов исправлены)

| # | Баг | Root Cause | Fix |
|---|-----|------------|-----|
| 1 | Locale ru/en | Telegram сессия кешировала ru | Пересоздана сессия |
| 2 | Demo adhoc | Нет примера сообщения | EXAMPLE MESSAGE в demo-video-script.md |
| 3 | Explore сухо | Краткое описание | Развёрнутое описание в flow landmarks |
| 4 | "возраст контекста" | Неточный термин | "context recency" в FILTERS_BLOCK |
| 5 | Explore формат | Только matched показывался | Transition: matched → current в NLP prompt |
| 5.1 | Explore = Waymate | `candidateType: "waymate"` hardcoded | Добавлен `exploreToChart()` с `candidateType: "similar"` |
| 6 | Страна в цели | `goal: storedGoal` передавал Goal, не TargetContext | `goal: storedGoal?.targetContext` + schema fix |
| 7 | Count ≠ тесты | = #11/#12 (NLP не считал) | - |
| 8 | Missing fields порционно | `MAX_QUESTIONS_PER_BATCH=5` отсекал | Убрал ограничение полностью |
| 9 | Эталон позиций | Нет таблицы с industry/city | Добавлена таблица + warnings в demo-video-script.md |
| 10 | Position 3 слабо | Prompt запрещал инференс | Разрешён инференс industry/domains из контекста |
| 11/12 | NLP count ≠ Chart | LLM "угадывал" количество | Reasoning: "state exact count" |

**Изменённые файлы:**
- `src/facade/langGraph/search-graph/response-builders.ts` — goal → targetContext
- `src/facade/langGraph/search-graph/chart-utils.ts` — exploreToChart()
- `src/facade/langGraph/cold-start-v2/nodes/validate-context.ts` — убран MAX_QUESTIONS_PER_BATCH
- `src/facade/langGraph/cold-start-v2/prompts.ts` — инференс industry/domains
- `src/facade/services/nlp-formatter/prompts.ts` — explore transition, context recency, count requirement
- `src/shared/schemas.ts` — goal: targetContextSchema вместо goalSchema
- `src/chart/types.ts` — добавлен candidateType "similar"
- `.claude/commands/demo-video-script.md` — примеры, эталоны, warnings

### Phase 8: Verification + Rollback

**Инфра:**
- Neo4j контейнер упал → перезапущен
- Demo fixtures перезагружены через `scripts/import-demo-fixtures.ts`
- Удалён лишний user (usr_019ba785...)
- Удалён Demo-Alex (чтобы не находить себя в поиске)

**Locale фикс:**
- `bot:docker:clean` — сброс Telegram сессии решает проблему ru→en

**Попытка фикса #5 (explore transition) — ОТКАТАНО:**
- Добавил `currentContext` в `candidateBaseSchema`
- Добавил `computeCurrentContext()` в `search-manager.ts`
- Обновил NLP prompt для использования currentContext
- **Проблема:** JSON serializer фильтровал null → LLM не видел `currentContext: null`
- **Решение:** Откатили все изменения, оставили как было

**Prompt leak фикс:**
- `NO_TRANSLATE_INSTRUCTION` утекал в output как "КРИТИЧЕСКИ: Не переводите торговые марки"
- **Фикс:** Сокращён до `Never translate: field values, Pathfinders, Waymates.`

**Demo-video-script обновлён:**
- Убрана фаза Explore из short demo (сразу к goal)
- Команды заменены на `npm run telegram-chat --`

### Phase 9: NLP Reasoning Enhancement (текущая сессия)

**Баг #2 (Role не показывается в Goal) — ПОФИКШЕН:**
- **Root cause:** LLM считал role redundant с position ("head of engineering" implies "manager")
- **Решение A:** Усилен reasoning schema — 5 обязательных шагов включая "why field was skipped"
- **Решение B:** Добавлен input log (resultsCount, goalRole) для debug
- **Решение C:** Добавлена инструкция "Never assume redundancy — show all non-null fields" в GOAL_BLOCK
- **Результат:** ✅ Role теперь показывается

**Баг "5 vs 4 pathfinders" — частично разобрались:**
- Input log показывает `resultsCount: 4`
- LLM reasoning показывает `results: 5 items`
- **Причина:** При goal.set создаётся User в Neo4j (MERGE в Cypher) → test user попадает в поиск
- **Workaround:** Удалять garbage users перед demo

**Demo-video-script Pre-Recording Checklist обновлён:**
- Добавлены actionable команды (не просто проверки)
- 6 шагов: Setup → Fixtures → Clean → Goals → Redis → Dict cache
- Добавлен workflow: check → confirm → record
- Расширены allowed-tools для инфра-команд

**Открытые проблемы:**
- NLP "❗️ Missing fields:" с ⚪️ — не воспроизвели в логах
- 5 vs 4 mismatch — откуда LLM видит 5 если Core вернул 4?

**Изменённые файлы (Phase 9):**
- `src/facade/services/nlp-formatter/nlp-formatter.service.ts` — reasoning schema + input logging
- `src/facade/services/nlp-formatter/prompts.ts` — "Never assume redundancy" в GOAL_BLOCK
- `.claude/commands/demo-video-script.md` — actionable checklist + allowed-tools + workflow

---

## Что осталось сделать

1. **Commit изменений** — lint:fix + tsc + commit (Phase 9 changes)
2. **5 vs 4 mismatch** — разобраться откуда LLM видит 5 items если resultsCount: 4
3. **Bug #5 (Explore transition)** — НЕ исправлен, откатили. Оставить как есть или придумать другой подход
4. **Чистка garbage users** — автоматизировать перед demo (сейчас вручную)

---

## Чеклист верификации (следующая сессия)

### SHORT demo — на что смотреть:

| Фикс | Что проверить | Ожидаемое |
|------|---------------|-----------|
| #4 context recency | Фраза в Filters блоке | "context recency", НЕ "возраст контекста" |
| #5 Explore transition | Формат кандидатов в explore | `position → currentPosition (country)`, НЕ `position (country) — domains` |
| #5.1 Explore = similar | Chart badge в explore | "(Similar)", НЕ "(Waymate)" |
| #6 Страна в цели | Goal блок в pathfinders/waymates | countries показывается если задан |
| #11/12 Count match | Количество в тексте vs chart | Одинаковое (4 и 4, не 3 и 5) |
| #2 Adhoc пример | При вводе контекста по примеру | Все поля извлечены с первого раза |

### LONG demo (cold-start) — на что смотреть:

| Фикс | Что проверить | Ожидаемое |
|------|---------------|-----------|
| #8 Missing fields | После первого clarification | ВСЕ missing показаны сразу, не порционно |
| #9 Эталон позиций | Position 1-2 industry | "technology", НЕ "fintech" |
| #9 Эталон позиций | Все позиции city | "Rostov-on-Don", НЕ "Moscow" |
| #10 Position 3 extraction | Извлечённые поля | industry/domains извлечены из контекста CV |

### Регрессии — НЕ должно сломаться:

- [ ] Adhoc extraction работает
- [ ] Goal extraction работает
- [ ] Chart генерируется для explore/pathfinders/waymates
- [ ] NLP formatter отвечает на правильном языке (locale)
- [ ] Cold-start flow доходит до saved
- [ ] Integration tests проходят

---

## Артефакты

| Файл | Что |
|------|-----|
| `sessions/2026-01-10-demo-bugs-plan.md` | Детальный план работ с 13 багами |
| Explore chart | https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/019ba6da-d73a-75e8-9b5f-18d0c3995bcb.html |
| Pathfinders chart | https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/019ba6e8-dc05-7774-926f-f5edc3ee60aa.html |
| Waymates chart | https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/019ba6eb-4e6c-7494-a209-c46e2491b90a.html |

---

## Ключевые наблюдения

1. **Chart vs NLP данные** — генерируются из разных источников или в разное время
2. **candidateType в explore** — hardcoded как Waymate, должен быть neutral/explore
3. **Demo-Alex.json** — эталон для cold-start, нужно явно указать в промпте
4. **Locale** — проблема глубже чем GramJS, NLP formatter иногда игнорирует

---

## Промпт для продолжения после rewind

```
Продолжаем сессию: sessions/2026-01-10-demo-video-extraction-debug.md

КОНТЕКСТ (Phase 9 завершена):
- NLP reasoning усилен: 5 обязательных шагов, input logging
- Баг "Role не показывается" ПОФИКШЕН (инструкция "Never assume redundancy")
- Demo-video-script: actionable Pre-Recording Checklist
- Код изменён, НЕ закоммичен

ОТКРЫТЫЕ ВОПРОСЫ:
- 5 vs 4 mismatch: Input=4, LLM видит 5. Причина: test user создаётся при goal.set?
- NLP "❗️ Missing fields:" с ⚪️ — не воспроизвели

ЗАДАЧА: Commit + финализация

1. npm run lint:fix && npx tsc --noEmit
2. Проверить что 10 users в Neo4j (удалить garbage если есть)
3. npm run facade:rebuild
4. Короткий тест через telegram-chat (goal + pathfinders)
5. Commit если всё ок

ИЗМЕНЁННЫЕ ФАЙЛЫ:
- src/facade/services/nlp-formatter/nlp-formatter.service.ts
- src/facade/services/nlp-formatter/prompts.ts
- .claude/commands/demo-video-script.md
```
