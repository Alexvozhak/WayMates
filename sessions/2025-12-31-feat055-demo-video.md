# Session: FEAT-055 Demo Video

**Дата:** 2025-12-31
**Фокус:** Подготовка демо видео для pre-seed — фикстуры, DTW, batch тесты, CV парсинг

---

## Сделано

### Phase 1-6.1: Завершено в предыдущих сессиях

- 10 demo фикстур созданы
- DTW unit test прошёл
- demo-adhoc.yaml 9/9 ✅
- setGoal routing bug fix
- Dictionary/fixtures mismatch fixes

### Phase 6.2: strictFields fix (ЗАВЕРШЕНО)

**Проблема:** Pathfinder search возвращал 0 результатов для cold-start user.

**Root cause:** `strictFields` по умолчанию включал ВСЕ поля (кроме skills).

**Fix:** Добавлен `DEFAULT_EXCLUDED_CONTEXT_FIELDS` в Facade.

### Phase 6.3: Dictionary sync (ЗАВЕРШЕНО)

- Словари обновлены в Neo4j (positions, roles)
- LLM извлекает: `technical project manager` / `manager` / `fintech`

### Phase 6.4: Fixtures + Batch test (ТЕКУЩАЯ СЕССИЯ)

**Сделано:**
1. ✅ Обновлены ВСЕ Demo-*Pathfinder.json — matched context:
   - position: `"technical project manager"`
   - role: `"manager"`
   - domains: `["management", "backend"]`
   - industry: `"fintech"`
   - countryCode: `"RU"`

2. ✅ Обновлены ВСЕ Demo-*Waymate.json — текущий контекст аналогично

3. ✅ Обновлён Demo-Alex.json — ctx3 с правильными position/role

4. ✅ Обновлён `demo-cold-start.yaml` step 7:
   ```yaml
   message: "change domain devops to backend, add skills: docker, terraform, prometheus, ethers.js"
   ```

5. ✅ Импортированы фикстуры: `npx tsx scripts/import-demo-fixtures.ts`

6. ✅ Проверено через Neo4j MCP:
   - 4 Pathfinders найдены (matched + target context)
   - 4 Waymates найдены (current context)
   - Context domains: `["management", "backend"]` ✅
   - Context domains (extracted): `["backend", "management"]` ✅

7. ✅ Goal сохраняется правильно:
   ```json
   {"position":{"mode":"desired","values":["head of engineering"]}, "countries":{"values":["NL"]}, ...}
   ```

**Проблема (НЕ РЕШЕНА):**
- Batch test: `chartUrl: null` — pathfinders не находятся
- Goal сохранён, domains совпадают, но search возвращает 0

---

## Обнаруженные проблемы

### Goal хранится как JSON blob, не properties

**Проблема:** Goal.targetContext = JSON string. Нельзя искать через Cypher напрямую.

**Моя ошибка:** Проверял `g.position`, `g.domains` — всегда null. На самом деле `g.targetContext` содержит JSON.

**Создан:** `tasks/features/FEAT-057-goal-graph-storage.md` — план рефакторинга.

---

## Осталось сделать

### Критично (для демо)

- [ ] **Дебаг pathfinder search** — почему 0 результатов при правильных данных?
  - Goal: `{"position": "head of engineering", "countries": ["NL"], "domains": ["ai"]}`
  - Target в фикстурах: `position: "head of engineering"`, `countryCode: "NL"`, `domains: ["ai", "platform", "management"]`
  - Возможно mismatch в domains (Goal=["ai"], fixtures=["ai","platform","management"])

- [ ] Прогнать demo-cold-start.yaml — chartUrl не null
- [ ] Убедиться что Advisor цитирует feedbacks

### Phase 7: grammY e2e tests

- [ ] `tests/telegram-bot/e2e/demo-video-1.e2e.ts` (adhoc)
- [ ] `tests/telegram-bot/e2e/demo-video-2.e2e.ts` (PDF upload)

### Финал

- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW + PDF, ≤5.5 мин)

### Tech Debt (не блокирует демо)

- [ ] FEAT-057: Goal как properties, не JSON blob

---

## Ключевые артефакты

| Файл | Статус |
|------|--------|
| `tests/core/fixtures/Demo-*.json` | ✅ Обновлены |
| `tests/e2e/batches/demo-cold-start.yaml` | ✅ Step 7 с clarification |
| `tasks/features/FEAT-057-goal-graph-storage.md` | ✅ Создан |

---

## Проблемы и решения

### LLM извлекает devops, фикстуры требуют backend

**Проблема:** LLM извлекает `domains: ["devops", "management"]` из CV Technical PM.

**Решение:** Добавить clarification в batch test:
```yaml
message: "change domain devops to backend, add skills: ..."
```

**НЕ ДЕЛАТЬ:** Менять фикстуры под LLM extraction. Фикстуры = бизнес-требования.

### Goal.targetContext — JSON blob

**Факт:** В Neo4j `(:Goal {targetContext: '{"position": ...}'})` — не отдельные properties.

**Проверка:**
```cypher
-- Правильно:
MATCH (g:Goal) RETURN g.targetContext

-- Неправильно (всегда null):
MATCH (g:Goal) RETURN g.position
```

---

## Промпт для продолжения после rewind

```
Продолжаем FEAT-055 Demo Video.

ПРОЧИТАЙ ПОЛНОСТЬЮ: `/home/alex/projects/WayMatesRemote/sessions/2025-12-31-feat055-demo-video.md`

**Статус:** Phase 6.4. Фикстуры обновлены, импортированы. Batch test НЕ проходит.

**Проблема:** pathfinders не находятся, chartUrl = null. Данные правильные:
- 4 Pathfinders в Neo4j с matched context = ["management", "backend"]
- Goal сохранён: position="head of engineering", countries=["NL"], domains=["ai"]
- Target в фикстурах: position="head of engineering", countryCode="NL", domains=["ai","platform","management"]

**Гипотеза:** domains mismatch между Goal (["ai"]) и target context (["ai","platform","management"])?

**Следующий шаг:**
1. Проверить Cypher query searchPathfinders — как он матчит Goal с target context
2. Или расширить Goal domains при извлечении

**Команда для batch test:**
set -a && source .env.test && set +a && OPENROUTER_API_KEY=sk-or-v1-... timeout 300 npx tsx poc/mcp-chat.ts --session demo-cs-v5 --reset --batch tests/e2e/batches/demo-cold-start.yaml
```
