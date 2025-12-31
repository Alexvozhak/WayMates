# Session: FEAT-055 Demo Video

**Дата:** 2025-12-31
**Фокус:** Подготовка демо видео для pre-seed — фикстуры, DTW, batch тесты

---

## Сделано

### Phase 1-2: Фикстуры и DTW (ЗАВЕРШЕНО)

1. **Обновлён FEAT-055** (`tasks/features/FEAT-055-demo-video.md`):
   - Добавлен полный контекст DTW (формулы, бизнес-интерпретация)
   - Траектория Alex из CV (4 контекста)
   - 10 фикстур с feedbacks (включая warnings/negative experience)
   - Словари из `database/` для reference
   - Зависимости файлов для чтения

2. **10 demo фикстур созданы** (`tests/core/fixtures/Demo-*.json`):
   - 4 Pathfinders (IdealPathfinder, SprintPathfinder, AltRoutePathfinder, DirectPathfinder)
   - 4 Waymates (IdealWaymate, SprintWaymate, AltWaymate, DirectWaymate)
   - 2 ReversePathfinders (PMToFounder, DSToFounder)
   - Каждый context с feedback (до 200 символов)
   - Trails с userFeedback на каждом переходе

3. **DTW unit test прошёл** (11/11 tests):
   - Shape контраст ~0.3 между Ideal (0.839) и Alt (0.539)
   - Метрики дают визуальное различие для Spider Chart

### Phase 3: Batch test adhoc (В ПРОЦЕССЕ)

1. **Intent classifier исправлен** (`src/facade/services/orchestrator/intent-classifier.ts`):
   - `startAdhoc` теперь семантический: "lightweight temporary search without creating persistent profile"
   - Убраны точные ключевые слова — LLM понимает намерение

2. **Словари загружены** в Neo4j (roles, positions, domains, etc.)

3. **Кэш Redis** — была проблема с пустым кэшем roles, исправлено через:
   - `docker exec waymates-redis-test redis-cli DEL "waymates:dict:role"`
   - `docker restart waymates-facade-test`

4. **demo-adhoc.yaml** — 6/8 assertions прошли, flow работает:
   - `confirming_adhoc_context` → `showing_exploration_candidates` → `showing_goal` → `asking_search_mode` → `showing_pathfinder_results` → `advising`

---

## Осталось сделать

### Phase 3: Batch test adhoc (ПРОДОЛЖИТЬ)
- [ ] Финализировать demo-adhoc.yaml — запустить полный прогон
- [ ] Убедиться что Chart URL генерируется

### Phase 4: Batch test cold-start
- [ ] Создать `demo-cold-start.yaml` с CV markdown из `KomarovAlex2025.md`
- [ ] Протестировать что cold-start парсит 4 контекста

### Phase 5: Goal для Waymates
- [ ] Решить как устанавливать Goal для waymates фикстур:
  - Вариант A: Setup скрипт `scripts/setup-demo-goals.ts`
  - Вариант B: В grammY тесте перед демо
  - Вариант C: Cypher в init.cypher

### Phase 6: grammY e2e tests
- [ ] Создать `tests/telegram-bot/e2e/demo-video-1.e2e.ts` (adhoc)
- [ ] Создать `tests/telegram-bot/e2e/demo-video-2.e2e.ts` (PDF upload)
- [ ] Отправка `Profile.pdf` через Telegram API

### Финал
- [ ] Записать Video 1 (adhoc, ≤3.5 мин)
- [ ] Записать Video 2 (cold-start + DTW, ≤5.5 мин)

---

## Ключевые артефакты

| Файл | Назначение |
|------|------------|
| `tasks/features/FEAT-055-demo-video.md` | Полный план с контекстом |
| `tests/core/fixtures/Demo-*.json` | 10 demo фикстур |
| `tests/e2e/batches/demo-adhoc.yaml` | Batch test adhoc flow |
| `KomarovAlex2025.md` | CV markdown для cold-start |
| `Profile.pdf` | CV PDF для grammY e2e |

---

## Проблемы и решения

### 1. Intent classifier требовал точные слова
**Проблема:** `startAdhoc` требовал "find" или "search" в сообщении.
**Решение:** Изменил описание на семантическое без ключевых слов.

### 2. Role не извлекался из "backend developer"
**Проблема:** LLM извлекал `role: "developer"`, но normalizer терял его.
**Причина:** Redis кэш roles был пустой `[]` (загружен до импорта словарей).
**Решение:** `redis-cli DEL "waymates:dict:role"` + restart facade.

### 3. Словари не импортировались
**Проблема:** `db:test:init` не импортировал roles.
**Причина:** Скрипт импорта падал молча.
**Решение:** Запустить `scripts/import-roles.sh test` вручную.

---

## Промпт для продолжения после rewind

```
Продолжаем FEAT-055 Demo Video.

**Статус:** Phase 1-2 завершены (фикстуры + DTW тест), Phase 3 в процессе.

**Контекст сессии:** `/home/alex/projects/WayMatesRemote/sessions/2025-12-31-feat055-demo-video.md`

**Следующий шаг:** Финализировать demo-adhoc.yaml batch test (6/8 уже прошли).

**Инфра:** Словари загружены, кэш исправлен. Facade пересобран.

Запусти batch test:
```bash
set -a && source .env.test && set +a && OPENROUTER_API_KEY=<key> timeout 180 npx tsx poc/mcp-chat.ts --batch tests/e2e/batches/demo-adhoc.yaml
```
```
