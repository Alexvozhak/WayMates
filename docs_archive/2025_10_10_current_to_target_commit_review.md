# Анализ коммита df6ee19b7c71a5d6eda14a6305af6f88365039f9

**Дата анализа:** 10 октября 2025  
**Коммит:** `df6ee19b7c71a5d6eda14a6305af6f88365039f9`  
**Автор:** Alexey Komarov  
**Дата коммита:** 11 октября 2025, 01:37:23 +0300

## Краткое резюме

Коммит добавляет систему батч-тестирования для проверки чувствительности пресетов в режиме `current-to-target`. Реализация включает фикстуры, тестовые данные и ожидания, но содержит **4 критических расхождения** между ожидаемыми и фактическими результатами алгоритма.

**Статус:** ❌ **НЕ ГОТОВ К МЕРЖУ** - требуется исправление расхождений  
**Сложность исправления:** 🟡 Средняя (2-3 дня)  
**Ценность кода:** 🟢 Высокая - хорошая архитектура, но неверные ожидания

---

## Что добавлено в коммите

### 1. Новая система батч-тестирования
- **Фикстура:** `tests/helpers/current-to-target-batch-fixture.ts` (188 строк)
- **Функциональные тесты:** `tests/functional/current-to-target-presets.test.ts` (164 строки)
- **Тестовые данные:** 2 батча с историями пользователей и ожиданиями
- **Новый пресет:** `BALANCED_GEO_STRICT` в `config/presets.json`

### 2. Структура тестовых данных
```
tests/data/current-to-target-batches/
├── batch_preset_coverage/     # Основной батч с 4 кандидатами
│   ├── stories.json          # 4 пользователя с контекстами
│   └── expected-results.json # Ожидания по пресетам
└── batch_no_candidates/      # Пустой батч для edge cases
    ├── stories.json
    └── expected-results.json
```

### 3. Документация
- **Отчёт автора:** `docs/current-to-target-test-batches.md` (85 строк)
- **README батчей:** `tests/data/current-to-target-batches/README.md`

---

## Анализ падающих тестов

### ❌ Тест 1: "matches expected candidates and scores for each preset"
**Ошибка:** `expected [A, B, C] to equal [B, C]`

**Проблема:** Референс-пользователь `usr_9TSC4HHC5HWYDYFHRJXQ1TNN8V` попадает в результаты поиска, но ожидания его не включают.

**Причина:** В `buildTargetTransitionQuery` есть фильтр `AND dbTargetUser <> dbCurrentUser`, но он не исключает случаи, когда пользователь ищет сам себя через свои же контексты.

### ❌ Тест 2: "reduces matches when strict filters tighten"
**Ошибка:** `expected 24 < 24` (одинаковое количество результатов)

**Проблема:** Пресет `BALANCED_GEO_STRICT` не уменьшает выборку по сравнению с `BALANCED`.

**Причина:** В пресете `BALANCED_GEO_STRICT` поле `country_code` добавлено в `strictPresets`, но также остаётся в `flexiblePresets` с весом 20. Это создаёт конфликт логики.

### ❌ Тест 3: "changes compatibility score when weights shift"
**Ошибка:** `expected 0 > 0` (оба скора равны 0)

**Проблема:** Веса пресетов `SKILL_FOCUSED` и `GEO_FOCUSED` не влияют на итоговый `currentCompatibilityScore`.

**Причина:** Алгоритм расчёта в `buildFlexibleScoring` не соответствует ожиданиям из JSON. Фактически все кандидаты получают score = 0.

### ❌ Тест 4: "honours target preset expectations"
**Ошибка:** `expected undefined ≠ 100` (targetCompatibilityScore не рассчитывается)

**Проблема:** `targetCompatibilityScore` возвращается как `undefined` вместо ожидаемых значений.

**Причина:** Пресет `TARGET_FLEXIBLE` передаётся в оркестратор, но его веса не применяются к расчёту совместимости target-контекстов.

---

## Детальный анализ данных

### Референс-пользователь (usr_9TSC4HHC5HWYDYFHRJXQ1TNN8V)
- **Current:** Senior, fintech, Berlin, DE
- **Target:** TeamLead, fintech, Berlin, DE
- **Skills:** python, sql, pytorch

### Кандидат A (usr_N1YVWGEDWPEKKK8M70XJA40XDB) - Полное совпадение
- **Current:** Senior, fintech, Berlin, DE
- **Skills:** python, sql, pytorch, airflow
- **Ожидаемый score:** 100% по всем пресетам

### Кандидат B (usr_J7GCMXCMHKZESXRB0W692H5KG6) - Частичное совпадение
- **Current:** Senior, ecommerce, Munich, DE
- **Skills:** python, sql, pytorch, dbt
- **Различия:** industry (ecommerce vs fintech), city (munich vs berlin)
- **Ожидаемые scores:** 40% (FLEXIBLE), 20% (BALANCED), 55% (SKILL_FOCUSED), 50% (GEO_FOCUSED)

### Кандидат C (usr_KPVW268SDBA5152QSMHGAN32K7) - Минимальное совпадение
- **Current:** Senior, gaming, Warsaw, PL
- **Skills:** python, sql, pytorch
- **Различия:** industry, country, city, work_type, company_size, team_size
- **Ожидаемые scores:** исключён (FLEXIBLE), 10% (BALANCED), 40% (SKILL_FOCUSED), 15% (GEO_FOCUSED)

### Кандидат D (usr_QYRZZCB0XQBE4N4TAZDGDEN9A1) - Провал строгих фильтров
- **Skills:** python, sql (отсутствует pytorch)
- **Статус:** должен исключаться всеми пресетами из-за отсутствия обязательного навыка

---

## Технические проблемы

### 1. Конфликт в пресете BALANCED_GEO_STRICT
```json
{
  "strictPresets": [
    {"field": "country_code"}  // ← Строгий фильтр
  ],
  "flexiblePresets": [
    {"field": "country_code", "weight": 20}  // ← Гибкий вес
  ]
}
```
**Проблема:** Поле не может быть одновременно строгим и гибким.

### 2. Неверная формула расчёта совместимости
**Ожидания в JSON:** Дробные проценты (40%, 20%, 55%)  
**Фактический алгоритм:** Все кандидаты получают score = 0

**Причина:** `buildFlexibleScoring` генерирует Cypher, который не соответствует ожидаемой логике расчёта.

### 3. Отсутствие фильтрации self-reference
**Проблема:** Референс-пользователь попадает в результаты поиска  
**Решение:** Добавить фильтр `WHERE dbCurrentUser.user_id <> $currentContext.user_id`

### 4. Target preset не применяется
**Проблема:** `TARGET_FLEXIBLE` передаётся, но его веса не влияют на `targetCompatibilityScore`  
**Причина:** В `COMPATIBILITY_SCORE.cypher` используется переменная `targetContextCompatibilityScore` из предыдущего блока, а не пересчёт по весам target-пресета.

---

## Оценка сложности исправления

### 🟢 Простые исправления (1-2 часа)
1. **Исключить self-reference:** Добавить фильтр по `user_id` в `buildCurrentContextQuery`
2. **Исправить BALANCED_GEO_STRICT:** Убрать `country_code` из `flexiblePresets`

### 🟡 Средние исправления (1-2 дня)
3. **Пересчитать expected-results.json:** Привести ожидания в соответствие с фактическим алгоритмом
4. **Исправить формулу совместимости:** Скорректировать `buildFlexibleScoring` или обновить ожидания

### 🔴 Сложные исправления (2-3 дня)
5. **Реализовать target preset scoring:** Добавить пересчёт `targetCompatibilityScore` по весам target-пресета
6. **Переписать алгоритм совместимости:** Если текущая формула не соответствует бизнес-требованиям

---

## Рекомендации

### Немедленные действия
1. **НЕ мержить** коммит в текущем состоянии
2. **Исправить** конфликт в `BALANCED_GEO_STRICT`
3. **Добавить** фильтр self-reference
4. **Пересчитать** ожидания в `expected-results.json`

### Долгосрочные улучшения
1. **Создать** утилиту для генерации тестовых данных
2. **Добавить** валидацию пресетов (проверка конфликтов strict/flexible)
3. **Расширить** покрытие edge cases (временные фильтры, searchConstraints)
4. **Документировать** алгоритм расчёта совместимости

### Альтернативный подход
Если текущий алгоритм совместимости не соответствует ожиданиям, рассмотреть:
1. **Пересмотр** бизнес-требований к расчёту совместимости
2. **Создание** нового алгоритма, соответствующего ожиданиям
3. **Обновление** документации с описанием фактического поведения

---

## Положительные стороны

### ✅ Хорошая архитектура
- Чёткое разделение ответственности
- Переиспользуемые фикстуры
- Структурированные тестовые данные
- Подробная документация

### ✅ Покрытие функциональности
- Тестирование всех пресетов
- Проверка edge cases
- Валидация ожиданий
- Интеграционные тесты

### ✅ Качество кода
- TypeScript типизация
- Zod валидация
- Читаемые тесты
- Структурированные данные

---

## Детальное сравнение ожиданий vs реальности

### Тест 1: "matches expected candidates and scores for each preset"

| Пресет | Ожидается | Фактически | Расхождение |
|--------|------------|------------|-------------|
| FLEXIBLE | [usr_N1..., usr_J7...] | [usr_9T..., usr_J7..., usr_N1...] | +usr_9T... (референс) |
| BALANCED | [usr_N1..., usr_J7..., usr_KP...] | [usr_9T..., usr_J7..., usr_N1...] | +usr_9T..., -usr_KP... |
| BALANCED_GEO_STRICT | [usr_N1..., usr_J7...] | [usr_9T..., usr_J7..., usr_N1...] | +usr_9T... |

**Проблема:** Референс-пользователь `usr_9TSC4HHC5HWYDYFHRJXQ1TNN8V` попадает в результаты

**Причина:** В `buildCurrentContextQuery` нет фильтра исключения self-reference

**Рекомендация:** 🟢 **ИСПРАВИТЬ ПРОДАКШ** - добавить фильтр `WHERE dbCurrentUser.user_id <> $currentContext.user_id` в `buildCurrentContextQuery`

**Анализ:** Референс-пользователь находит сам себя через свои контексты. В `buildTargetTransitionQuery` уже есть фильтр `AND dbTargetUser <> dbCurrentUser`, но в `buildCurrentContextQuery` его нет.

---

### Тест 2: "reduces matches when strict filters tighten"

| Пресет | Ожидается | Фактически | Расхождение |
|--------|------------|------------|-------------|
| BALANCED | 3 кандидата | 3 кандидата | ✅ |
| BALANCED_GEO_STRICT | 2 кандидата | 3 кандидата | ❌ |

**Проблема:** Строгий фильтр `country_code` не исключает польского кандидата

**Причина:** В пресете `BALANCED_GEO_STRICT` поле `country_code` одновременно в `strictPresets` и `flexiblePresets`

**Рекомендация:** 🟢 **ИСПРАВИТЬ ПРОДАКШ** - убрать `country_code` из `flexiblePresets` в `BALANCED_GEO_STRICT`

**Дополнительно:** Добавить JSON схему валидации пресетов для предотвращения дублирования полей между `strictPresets` и `flexiblePresets`

---

### Тест 3: "changes compatibility score when weights shift"

| Кандидат | SKILL_FOCUSED | GEO_FOCUSED | Ожидается |
|----------|---------------|-------------|-----------|
| usr_J7... | 0 | 0 | skillScore > geoScore |

**Проблема:** Все кандидаты получают `currentCompatibilityScore = 0`

**Причина:** Алгоритм в `buildFlexibleScoring` не соответствует ожиданиям из JSON

**Анализ формулы в коде:**
```cypher
CASE WHEN ${candidateCtx}.industry = ${searchCtx}.industry THEN ${weight} ELSE 0 END
```

**Анализ ожиданий в JSON:**
- FLEXIBLE: country_code(40) + city_name(30) + industry(30) = 100%
- BALANCED: industry(25) + country_code(20) + city_name(15) + ... = 20%

**Рекомендация:** 🔴 **ТРЕБУЕТ РЕШЕНИЯ** - либо исправить алгоритм, либо пересчитать ожидания

---

### Тест 4: "honours target preset expectations"

| Кандидат | Ожидается | Фактически | Расхождение |
|----------|------------|------------|-------------|
| usr_N1... | 100 | undefined | ❌ |
| usr_J7... | 73.75 | undefined | ❌ |
| usr_KP... | 58.75 | undefined | ❌ |

**Проблема:** `targetCompatibilityScore` не рассчитывается

**Причина:** В `COMPATIBILITY_SCORE.cypher` используется переменная `targetContextCompatibilityScore` из предыдущего блока, а не пересчёт по весам `TARGET_FLEXIBLE`

**Рекомендация:** 🔴 **ТРЕБУЕТ РЕШЕНИЯ** - либо реализовать target preset scoring, либо убрать проверку

---

## Предположения и анализ

### 1. Референс-пользователь в результатах
**Предположение:** Автор тестов не ожидал, что пользователь может найти сам себя через свои контексты

**Код подтверждает:** В `buildTargetTransitionQuery` есть фильтр `AND dbTargetUser <> dbCurrentUser`, но он не покрывает случай self-reference в current-поиске

**Решение:** Добавить аналогичный фильтр в `buildCurrentContextQuery`

### 2. Конфликт strict/flexible полей
**Предположение:** Автор не заметил, что `country_code` добавлен в `strictPresets`, но остался в `flexiblePresets`

**Код подтверждает:** В `BALANCED_GEO_STRICT` поле `country_code` дублируется

**Решение:** Убрать из `flexiblePresets` или переименовать поле

### 3. Формула совместимости
**Предположение:** Автор рассчитывал ожидания вручную по весам пресетов, не учитывая фактический алгоритм

**Анализ весов:**
- FLEXIBLE: country_code(40) + city_name(30) + industry(30) = 100%
- BALANCED: industry(25) + country_code(20) + city_name(15) + work_type(10) + company_size(10) + team_size(10) + birth_year(10) = 100%

**Фактический алгоритм:** Суммирует веса только при точном совпадении полей

**Решение:** Либо исправить алгоритм для поддержки частичных совпадений, либо пересчитать ожидания

### 4. Target preset scoring
**Предположение:** Автор ожидал, что `TARGET_FLEXIBLE` будет применяться к расчёту `targetCompatibilityScore`

**Код подтверждает:** `TARGET_FLEXIBLE` передаётся в оркестратор, но его веса не используются в `COMPATIBILITY_SCORE.cypher`

**Решение:** Либо реализовать target preset scoring, либо убрать проверку из тестов

---

## Рекомендации по исправлению

### 🟢 Простые исправления (продакш)
1. **Добавить фильтр self-reference** в `buildCurrentContextQuery`
2. **Убрать дублирование** `country_code` в `BALANCED_GEO_STRICT`

### 🔴 Требуют решения (продакш vs тесты)
3. **Формула совместимости:** 
   - **Вариант A:** Исправить алгоритм для поддержки частичных совпадений
   - **Вариант B:** Пересчитать ожидания в JSON под текущий алгоритм
4. **Target preset scoring:**
   - **Вариант A:** Реализовать расчёт `targetCompatibilityScore` по весам target-пресета
   - **Вариант B:** Убрать проверку `targetCompatibilityScore` из тестов

### 🟡 Дополнительные улучшения
5. **Валидация пресетов:** JSON схема для проверки конфликтов strict/flexible полей
6. **Документация:** Описание алгоритма расчёта совместимости
7. **Утилиты:** Генератор тестовых данных и ожиданий
8. **CI/CD:** Автоматическая валидация пресетов при коммитах

---

## Заключение

Коммит представляет **ценную работу** по созданию системы тестирования пресетов, но содержит **критические расхождения** между ожиданиями и реализацией. 

**Рекомендация:** Исправить выявленные проблемы перед мержем. После исправлений код будет готов к продакшену и значительно улучшит качество тестирования алгоритмов поиска.

**Временные затраты на исправление:** 2-3 дня  
**Ценность после исправления:** Очень высокая
