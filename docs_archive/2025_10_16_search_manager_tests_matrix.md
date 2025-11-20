# План интеграционных тестов SearchManager

*Дата: 2025-10-16*

Документ описывает, какие сочетания пользовательских историй, пресетов и методов поиска мы покрываем в `tests/integration/search-manager.test.ts`. Он служит «источником правды» при генерации JSON-фикстур и написании самих кейсов.

---
## 1. Мини-датасет (4 истории)

| ID | Контекстов | Роль в тестах |
|----|------------|---------------|
| `u1` | 2 | Позитив — совпадение по *position* и *country* |
| `u2` | 2 | Позитив — совпадение по *country*, расхождение по *position* |
| `u3` | 2 | Негатив — разные *country* |
| `u4` | 1 | Негатив для pipeline (current == target) |

* Каждая история хранится отдельным JSON в `data/trails/users/test-fixtures/`.
* Для `u1/u2/u3` первый контекст = *current*, второй = *future*.

### Ключевые значения

| User | current.position | current.country | future.position | future.country |
|------|------------------|-----------------|-----------------|----------------|
| u1   | Frontend         | DE              | Frontend        | DE             |
| u2   | Frontend         | NL              | Frontend        | DE             |
| u3   | Backend          | FR              | Backend         | FR             |
| u4   | Frontend         | US              | —               | —              |

Этого достаточно, чтобы:
* получить совпадение / несовпадение по `position` и `country`;
* проверить pipeline, где current→future меняет страну.

---
## 2. Пресеты

| Имя | strictFields | flexibleFields | Ожидание |
|-----|--------------|----------------|----------|
| `full`          | `["position","country"]` | `["skills"]` | Совпадут u1/u2, не u3 |
| `positionOnly`  | `["position"]`             | `["country"]`| Совпадут u1/u2, не u3 |
| `countryOnly`   | `["country"]`              | `["skills"]` | Совпадут u1/u2, не u3 |
| `mismatch`      | `["skills"]`               | `["position"]`| Совпадений нет |

Пресеты добавляются во временный `config/presets.json` section **only for tests** (можно мокнуть).

---
## 3. Матрица методов vs пресетов

| Метод | currentPreset | targetPreset | Story | Результат |
|-------|---------------|--------------|-------|-----------|
| searchCurrentContext | full | — | u1 | ✚ 1 совпадение (u2) |
| searchCurrentContext | mismatch | — | u1 | Ø пусто |
| searchTargetContext  | countryOnly | — | u1 (targetContext NL) | Ø пусто |
| searchTargetContext  | countryOnly | — | u2 (targetContext DE) | ✚ 2 совпадения |
| searchPipeline       | full / countryOnly | — | u2 | ✚ переход (u2 current → future) |
| searchPipeline       | positionOnly / mismatch | — | u3 | Ø пусто |
| searchPipeline       | full / countryOnly | — | u4 | Ø пусто (один контекст) |

### Валидация пресетов

| Сценарий | Метод | Параметры | Ожидание |
|----------|-------|-----------|-----------|
| Неизвестный пресет | `searchCurrentContext` | preset=`"__invalid__"` | `throw Error("Invalid preset name")` |
| Неполный пресет (нет `domains/skills`) | `searchCurrentContext` | preset=`"badPreset"` (добавляется временно в `PRESETS`) | `throw Error("must include all required fields")` |

---
## 4. Селективность

Для одного позитивного кейса (`u1 + full`) выполняем два вызова:
1. `SelectivityService.rankStrictFields` возвращает `