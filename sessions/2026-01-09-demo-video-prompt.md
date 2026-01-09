# Session: Demo Video Prompt Creation

**Дата:** 2026-01-09
**Фокус:** Создание промпта `/demo-video-script` для записи демо-видео WayMates

---

## Что сделано

### Phase 1: Создан промпт `/demo-video-script`

**Файл:** `.claude/commands/demo-video-script.md`

**Функционал:**
- `/demo-video-script short` — быстрый adhoc поиск (~3 мин)
- `/demo-video-script long` — CV + DTW Spider Chart (~5 мин)
- `/demo-video-script check` — проверка инфры без записи

**Ключевые секции промпта:**
1. **Auto-start** — Claude начинает сразу при вызове, не ждёт команды
2. **Personal story** — "I'm Alex, building this for myself"
3. **Core principles** — honesty through anonymity, real paths including failures
4. **Real achievements** — DTW, Neo4j graph, dual matching, MCP architecture
5. **What NOT to highlight** — Telegram bot, "AI-powered", commodity stuff
6. **Honest scope** — MVP, community features next

### Phase 2: Определены реальные WOW-моменты

| Achievement | Why WOW | When to mention |
|-------------|---------|-----------------|
| **DTW algorithm** | Real CS, not API calls | Spider Chart |
| **Neo4j graph model** | Careers ARE graphs | Trajectories |
| **Dual matching** | Graph traversal, not JOINs | Pathfinders |
| **MCP architecture** | Pluggable service | Optional, tech |
| **225 users pipeline** | Real data, normalized | Results |

### Phase 3: Value Chain интегрирован

Три принципа из `waymates-value-chain-mindmap.md`:
1. **Honesty through anonymity** — people share failures
2. **Proof through evidence** — actual trajectories
3. **Quality through feedback** — community validates

**Ключевое:** "Not curated success stories — real trajectories"

---

## Что осталось сделать

### Тестирование промпта
- [ ] Прогнать `/demo-video-script short` — проверить flow
- [ ] Прогнать `/demo-video-script long` — проверить CV upload + DTW
- [ ] Убедиться что Demo-Alex.json эталон достижим

### Подготовка к записи
- [ ] Проверить инфру: 6 контейнеров, 11 demo users, 0 garbage
- [ ] Проверить что waymates имеют goals (4+)
- [ ] Убедиться что Profile.pdf на месте

### Возможные доработки промпта
- [ ] Добавить wrap-up скрипт (если нужен)
- [ ] Уточнить тайминги после тестового прогона

---

## Артефакты

| Файл | Описание |
|------|----------|
| `.claude/commands/demo-video-script.md` | Основной промпт |
| `tests/core/fixtures/Demo-Alex.json` | Эталон для extraction |
| `poc/telegram-chat.ts` | Инструмент для демо |
| `Profile.pdf` | CV для long видео |
| `docs/business/_archive/waymates-value-chain-mindmap.md` | Core principles |

---

## Ключевые решения

1. **Аргументы**: `short`/`long`/`check` вместо `1`/`2` — бизнесовые названия
2. **Hybrid commentary**: business value first, tech in parentheses
3. **Variant A timing**: комментарий ПЕРЕД действием, потом реакция
4. **Честный scope**: не говорить "Duolingo for careers", "verified transitions"
5. **Founder engineer positioning**: real achievements, not commodity

---

## Промпт для продолжения после rewind

```
Продолжаем Phase 21. Session: sessions/2026-01-09-demo-video-prompt.md

СДЕЛАНО:
- Создан промпт /demo-video-script (short/long/check)
- Определены реальные WOW: DTW, Neo4j graph, dual matching, MCP
- Интегрированы core principles (honesty through anonymity)
- Personal story + honest scope

TODO:
1. Прогнать /demo-video-script short — тест flow
2. Прогнать /demo-video-script long — тест CV + DTW
3. Записать видео

Инфра проверена: 6 контейнеров, 11 demo users, 0 garbage.
Инструмент: poc/telegram-chat.ts
```
