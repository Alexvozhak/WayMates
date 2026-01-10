# План работ: Баги Demo Video

**Дата:** 2026-01-10
**Источник:** Прогон /demo-video-script short + long

---

## КРИТИЧНЫЕ БАГИ

### 1. Locale — русский вместо английского

**Симптом:** LLM отвечает на русском даже когда пишу на английском.

**Где искать:**
- `src/telegram-bot/handlers/converse.ts:23` — `ctx.from.language_code`
- `src/facade/services/nlp-formatter/nlp-formatter.service.ts` — locale в format()

**Как проверить:**
```bash
docker logs waymates-facade-test --tail 100 | grep -E '"locale"'
```

**Гипотеза:**
- GramJS сессия кеширует `language_code: "ru"`
- Или NLP formatter игнорирует locale в некоторых фазах

**Решение:** Добавить логирование locale на входе в NLP formatter, проверить что передаётся.

---

### 2. Несоответствие количества: NLP vs Chart

| Фаза | NLP говорит | Chart показывает |
|------|-------------|------------------|
| Explore | 8 similar | 8 Waymates (!) |
| Pathfinders | 3 | 4 |
| Waymates | 5 | 4 |

**Где искать:**
- `src/facade/langGraph/search-graph/chart-utils.ts` — формирование chart data
- `src/facade/langGraph/search-graph/response-builders.ts` — results для NLP
- `src/chart/services/trajectory-transformer.ts` — candidateType

**Как проверить:**
```bash
docker logs waymates-facade-test --tail 200 | grep -E "explorationResults|pathfinderResults|waymatesResults"
```

**Гипотеза:**
- Chart и NLP получают разные данные
- Или chart генерируется ДО slice/filter

---

### 3. Explore показывает всех как "Waymate"

**Симптом:** На chart explore все кандидаты помечены "(Waymate)" хотя это НЕ waymates (нет goal).

**Скриншот:** Explore chart — 8 кандидатов, все "(Waymate)"

**Где искать:**
- `src/facade/langGraph/search-graph/chart-utils.ts` — `toChartCandidate()`
- `src/chart/types.ts` — `CandidateType`

**Гипотеза:** candidateType hardcoded или неправильно определяется для explore.

---

### 4. Потеряли страну в pathfinders adhoc

**Симптом:** В explore был `Country: RU`, в pathfinders его нет в Goal блоке.

**Где искать:**
- `src/facade/langGraph/search-graph/response-builders.ts` — `showing_pathfinder_results`
- Проверить что adhocContext передаётся

**Как проверить:**
```bash
docker logs waymates-facade-test --tail 100 | grep -E "adhocContext.*countryCode"
```

---

## СРЕДНИЕ БАГИ

### 5. "возраст контекста: любой момент" — непонятно

**Где:** `src/facade/services/nlp-formatter/prompts.ts` — FILTERS_BLOCK

**Исправить на:** "актуальность контекста" или "давность позиции"

---

### 6. Explore формат — показывать transition

**Текущий:** `technical project manager (RU) — backend, management • 12 months ago`

**Желаемый:** `technical project manager → head of engineering (NL) • 12 months ago`

**Где:** `src/facade/services/nlp-formatter/prompts.ts` — `showing_exploration_candidates`

**Проблема:** Explore не имеет targetContext (нет goal). Нужно показывать currentContext кандидата.

---

### 7. 3 pathfinders, 5 waymates — не совпадает с тестами

**Где проверить:** `tests/core/integration/search-manager/demo-fixtures.integration.ts`

**Как проверить:**
```bash
npm run test:integration -- -t "demo-fixtures" --run
```

**Гипотеза:** adhoc context или goal отличается от тестовых fixtures.

---

## COLD-START БАГИ

### 8. Грейд появился после citizenship

**Симптом:** Сначала показали missing: citizenship. После ввода — вдруг спросили про position level.

**Где искать:**
- `src/facade/langGraph/cold-start-v2/prompts.ts` — clarification prompt
- `src/facade/langGraph/cold-start-v2/nodes/` — validate-context

**Гипотеза:** Missing fields вычисляются динамически, не полный список сразу.

---

### 9. fintech/moscow вместо technology/rostov

**Симптом:** Claude дал неправильные данные для Position 2 (Team Lead).

**Решение для demo-video-script.md:**
```markdown
**CRITICAL**: For cold-start, compare each position with Demo-Alex.json:
- Position 1: technology, Rostov-on-Don, developer role
- Position 2: technology, Rostov-on-Don, developer role (NOT fintech/Moscow!)
- Position 3: fintech, Rostov-on-Don, manager role
```

---

### 10. Position 3 слабо распарсилась

**Симптом:** Показало только position + role + period, без domains/industry/city.

**Где искать:**
- `src/facade/langGraph/cold-start-v2/prompts.ts` — context extraction
- Сравнить с adhoc extraction prompts

---

## УЛУЧШЕНИЯ DEMO SCRIPT

### 11. Adhoc контекст с первого раза

**Текущий пример:**
```
"I'm a technical project manager in fintech, Russia. Backend background, management domain."
```

**Проблема:** Не всегда парсится полностью с первого раза.

**Решение:** Дать более явный пример:
```
"I'm a technical project manager (position level) in fintech (industry), Russia (country).
My domains are management and backend. I work as a manager (role)."
```

---

### 12. "explore" слишком сухо

**Текущее:**
```
Let's explore — see who else has a similar background.
```

**Желаемое:**
```
Before setting a specific goal, let's explore the landscape.
Who else started from a similar position? Where did they end up?
This helps when you're not sure where to go next...
```

---

## ПРИОРИТЕТЫ

| # | Баг | Приоритет | Сложность |
|---|-----|-----------|-----------|
| 1 | Locale ru/en | P0 | Medium |
| 2 | NLP vs Chart count | P0 | Medium |
| 3 | Explore = Waymate label | P1 | Easy |
| 4 | Потеряли страну | P1 | Easy |
| 5-6 | Формат/текст | P2 | Easy |
| 7 | Тесты не совпадают | P1 | Medium |
| 8-10 | Cold-start | P2 | Medium |
| 11-12 | Demo script | P2 | Easy |

---

## КАК ДЕБАЖИТЬ

### Логи NLP formatter
```bash
docker logs waymates-facade-test --tail 200 | grep -E "NLP formatter|reasoning|locale"
```

### Логи search results
```bash
docker logs waymates-facade-test --tail 200 | grep -E "Results:|pathfinder|waymate|explore"
```

### Проверить state графа
```bash
docker logs waymates-facade-test --tail 200 | grep -E "Executing|phase"
```

### Сравнить chart data vs NLP data
Добавить временный лог в `chart-utils.ts`:
```typescript
logger.info({ candidatesCount: candidates.length, chartCandidatesCount: chartData.length }, "chart vs candidates");
```
