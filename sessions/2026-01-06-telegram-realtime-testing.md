# Session: Telegram Real-Time Testing via GramJS CLI

**Дата:** 2026-01-06 → 2026-01-07
**Фокус:** Интерактивное тестирование cold-start через реальный Telegram + отладка багов + обновление tests_report.md

---

## Контекст

**Предыстория:** FEAT-059 Demo Video UX Fixes почти завершён. Phase 5 (Vision для Charts) отложен на post-MVP. Нужно было проверить что cold-start flow работает корректно и создаёт траекторию matching с Demo-Alex.json fixture для pathfinder search.

**Проблема:** Статичный batch test (`demo-cold-start.yaml`) не гарантирует совпадение с Demo-Alex.json из-за недетерминированности LLM extraction.

**Решение:** Создан новый подход — интерактивное тестирование через GramJS CLI, где Claude корректирует данные в реальном времени.

---

## Что сделано

### 1. Создан `poc/telegram-chat.ts` — GramJS CLI

Аналог `mcp-chat.ts`, но для реального Telegram:

```bash
# Использование
npx tsx poc/telegram-chat.ts "message"           # Отправить сообщение
npx tsx poc/telegram-chat.ts --file Profile.pdf  # Отправить файл
npx tsx poc/telegram-chat.ts --start             # Отправить /start
npx tsx poc/telegram-chat.ts --wait-double "msg" # Ждать 2 ответа (для CV upload)
```

**Преимущества:**
- Claude может отправлять сообщения в реальный Telegram
- Видит ответы бота в stdout
- Может корректировать в реальном времени
- Не зависит от недетерминированности LLM extraction

### 2. Cold-start flow через Telegram успешно пройден

**Результат:**
- 3 контекста созданы
- 4 pathfinders найдены
- 1 waymate найден
- Matching работает!

### 3. Исправлен `scripts/cleanup-test-user.ts`

Добавлено удаление Goal (раньше не удалялся):

```typescript
// 2.1 Delete Goal from Neo4j (not included in deleteStory)
const goalResult = await trpc.goal.delete.mutate({ userId });
```

---

## Баги найденные

| # | Баг | Severity | Статус | Решение |
|---|-----|----------|--------|---------|
| 1 | Context clarification не применяется | 🔴 Critical | ✅ FIXED | Unified merge в `extract-context.ts` с `contextClarificationPrompt` |
| 2 | Дубликаты в skills/citizenships | 🟡 Medium | ✅ FIXED | `dedupeArray()` в `extract-context.ts` |
| 3 | Summary не показывает period | 🟡 Medium | ✅ FIXED | NLP prompt: период из createdAt соседних контекстов |
| 4 | cleanup-test-user.ts не удалял Goal | 🟡 Medium | ✅ FIXED | Добавлено в script |
| 5 | Chart URL не отображается | 🟡 Medium | ⚪ NOT A BUG | `candidates.length === 0 → chartUrl = null` |
| A | Session expired после /start | 🔴 Blocker | ✅ FIXED | Redis cleanup в `cleanup-test-user.ts` (dev-only) |
| B | Zod errors показываются пользователю | 🟡 Major | ✅ FIXED | NLP prompt: rephrase zodMessage |
| C | Format inconsistency | 🟢 Minor | ⚪ DEFERRED | Разные фазы = разные форматы (OK) |
| D | Industry inheritance между позициями | 🟡 Major | ✅ FIXED | `POSITION_INDEPENDENCE_RULE` с `CONTEXT_REQUIRED_FIELDS` |

---

## Детали багов (для отладки)

### Баг #1: Industry clarification не применяется

**Симптом:** Отправил `"technology"` на MISSING industry → в Neo4j записалось `"undisclosed"`.

**Где искать:**
- `src/facade/langGraph/cold-start-v2/nodes/validate-context.ts`
- `src/facade/langGraph/cold-start-v2/prompts/` — merge context prompt

**Гипотеза:** LLM merge prompt игнорирует простые ответы типа "technology" — ожидает формат "industry: technology" или сложнее.

### Баг #2: Дубликаты при merge

**Симптом:** После нескольких clarifications skills = `["c++", "python", "c++", "android", "c++", "qt5"]`

**Где искать:**
- `src/facade/langGraph/cold-start-v2/nodes/merge-context.ts` (или где merge logic)

**Решение:** Добавить `[...new Set(skills)]` после merge.

### Баг #3: createdAt не в Summary

**Симптом:** Summary показывает контексты без года (2016-2023, 2023-2025, 2025-present).

**Где искать:**
- `src/facade/services/nlp-formatter/prompts.ts` — COLD_START_PROMPTS

### Баг #5: Chart URL не отображается

**Симптом:** Ответ содержит "📊 Open trajectory chart" но без URL.

**Где искать:**
- `src/facade/langGraph/search-graph/response-builders/` — chartUrl должен передаваться
- NLP prompt должен включать URL в output

---

## Данные в Neo4j (текущее состояние)

После ручной коррекции через Cypher:

| Context | position | role | domains | industry |
|---------|----------|------|---------|----------|
| 1 | middle | developer | backend, mobile | technology |
| 2 | team lead | developer | backend, security | technology |
| 3 | technical project manager | manager | management, backend | fintech |

**User ID:** `usr_019b93cc-b448-7607-a21e-1e8035f8dd8c` (Telegram 379154408)

---

## Что осталось сделать

1. **Коммит изменений** — все фиксы готовы, lint+tsc прошли
2. **Продолжить обкатку workflows** — тестировать другие сценарии (search, update-context, etc.)
3. **Документировать telegram-chat.ts** — добавить в KNOWLEDGE-BASE.md

---

## Полезные команды

```bash
# Telegram CLI
set -a && source .env.test && set +a
npx tsx poc/telegram-chat.ts --start
npx tsx poc/telegram-chat.ts "message"
npx tsx poc/telegram-chat.ts --file Profile.pdf

# Cleanup user
npx tsx scripts/cleanup-test-user.ts --telegramId 379154408

# Cypher fix (если нужно вручную)
MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
WHERE u.telegramUserId = 379154408
SET c.industry = 'technology'
```

---

## Инсайты сессии

1. **Unified merge pattern** — паттерн из search-graph (`clarifyAdhocContext`) перенесён в cold-start. Если есть `pendingContext` → merge, иначе → extract from scratch.

2. **Position independence** — LLM склонен наследовать поля между позициями (industry, skills). Добавлено явное правило `POSITION_INDEPENDENCE_RULE` с перечнем полей из `CONTEXT_REQUIRED_FIELDS`.

3. **Dev-only fixes vs prod fixes** — Session expired баг = dev-only проблема (Redis cache stale). Fix в cleanup script, не в prod коде.

4. **tests_report.md обновлён** — добавлены:
   - Две роли: пользователь + программист
   - Критерии 10-16 (техническая утечка, консистентность, reasoning)
   - Severity guide + workflow тестирования

5. **Single source of truth для правил** — использовать константы (`CONTEXT_REQUIRED_FIELDS`) в промптах вместо hardcoded списков.

---

## Изменённые файлы (для коммита)

```
src/facade/langGraph/cold-start-v2/nodes/extract-context.ts  — unified merge + dedupeArray
src/facade/langGraph/cold-start-v2/prompts.ts               — contextClarificationPrompt + POSITION_INDEPENDENCE_RULE
src/facade/services/nlp-formatter/prompts.ts                — period из createdAt + rephrase zodMessage
scripts/cleanup-test-user.ts                                — Redis cache cleanup
mvp-test-final/tests_report.md                              — две роли + критерии 10-16
```

---

## Промпт для продолжения (после rewind)

```
ПРОЧИТАЙ ПОЛНОСТЬЮ:
1. `/home/alex/projects/WayMatesRemote/sessions/2026-01-06-telegram-realtime-testing.md` — session log
2. `/home/alex/projects/WayMatesRemote/src/facade/langGraph/cold-start-v2/prompts.ts` — extraction/clarification prompts
3. `/home/alex/projects/WayMatesRemote/mvp-test-final/tests_report.md` — следовать критериям (две роли, 1-16)

**Контекст:** Баги #1-3, A, B, D исправлены. lint+tsc прошли. НЕ закоммичено.

**TODO:**
1. Коммит изменений (см. "Изменённые файлы" в session log)
2. Продолжить обкатку cold-start через telegram-chat.ts
3. Следовать tests_report.md: пользователь + программист, reasoning в логах, severity guide

**Инструменты:**
- `poc/telegram-chat.ts` — GramJS CLI (--start, "message")
- `scripts/cleanup-test-user.ts --telegramId 379154408` — cleanup с Redis
- `docker logs waymates-facade-test --tail 100 | grep reasoning` — смотреть reasoning
```
