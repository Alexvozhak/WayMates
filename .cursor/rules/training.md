---

## Cypher Cookbook (WayMates): от базового к продвинутому

Это практическое руководство по Cypher, отсортированное по темам и сложности. Все примеры адаптированы под модель WayMates:

- Узлы: `User`, `Context`, `Role`, `Grade`, `Industry`, `WorkDomain`, `Skill`, `SkillCategory`
- Связи: 
  - `(:User)-[:HAS_CONTEXT {is_current: true/false}]->(:Context)`
  - `(:Context)-[:IN_ROLE]->(:Role {name})`
  - `(:Context)-[:HAS_GRADE]->(:Grade {name})`
  - `(:Context)-[:IN_INDUSTRY]->(:Industry {name})`
  - `(:Context)-[:IN_WORK_DOMAIN]->(:WorkDomain {name})`
  - `(:Context)-[:USES_SKILL]->(:Skill {name})-[:IN_CATEGORY]->(:SkillCategory {name})`
- Ключевые свойства `Context`: `context_id`, `role`, `grade`, `company_industry`, `company_size`, `domains_covered` (list), `languages` (list), `runtimes`, `frameworks`, `libraries`, `databases`, `cloud`, `devops_tools`, `testing_tools`, `skills_hard`, `role_started_at` (YYYY-MM), `period_start`, `period_end`, `created_at`

Содержание:
- 1. Базовый матч и возврат
- 2. Фильтрация по свойствам и спискам
- 3. Возврат полей и проекции
- 4. Сортировка, пагинация
- 5. OPTIONAL MATCH и устойчивые запросы
- 6. Переменная длина пути и «окрестности»
- 7. Агрегации и группировки
- 8. Работа со списками (UNWIND, предикаты any/all/none/single)
- 9. Подзапросы CALL { … } и коррелированные запросы
- 10. Даты и время
- 11. Наличие шаблонов (EXISTS { … })
- 12. Производительность: EXPLAIN/PROFILE, индексы, подсказки
- 13. Полнотекстовый поиск (опционально)
- 14. Запись данных: CREATE/MERGE/SET/FOREACH
- 15. Безопасные обновления и удаление

## Как работать с параметрами в Neo4j Browser

### Установка параметров
Перед выполнением запросов с `$параметр` установи значения:

**Базовые параметры:**
```
:param userId => "u1";
:param ctxId => "ctx1";
:param limit => 25;
:param offset => 0;
```

**Для пагинации:**
```
:param offset => 0;
:param limit => 10;
```

**Для фильтрации:**
```
:param role => "Software Developer";
:param industry => "fintech";
```

### Проверка параметров
```
:params
```

### Альтернатива: замена параметров на конкретные значения
Вместо `$offset` и `$limit` можно писать `SKIP 0 LIMIT 10` для быстрого тестирования.

---

### 1) Базовый матч и возврат (пошаговая прогрессия)

**Шаг 1.1** — Найти все контексты (база)
```cypher
MATCH (c:Context)
RETURN c
LIMIT 25
```
- Для чего: посмотреть все контексты в графе.
- Как: `MATCH` + метка узла, `RETURN`, `LIMIT`.

**Шаг 1.2** — Добавляем фильтр по конкретному ID
```cypher
MATCH (c:Context)
WHERE c.context_id = 'ctx1'
RETURN c
```
- Для чего: найти конкретный контекст (из test-context-1.json).
- Как: `WHERE` + точное сравнение свойства.

**Шаг 1.3** — Возвращаем только нужные поля
```cypher
MATCH (c:Context)
WHERE c.context_id = 'ctx1'
RETURN c.context_id AS id, c.role AS role, c.grade AS grade
```
- Для чего: компактный вывод ключевых полей.
- Как: явный список полей в `RETURN`.

**Шаг 1.4** — Добавляем информацию о компании
```cypher
MATCH (c:Context)
WHERE c.context_id = 'ctx1'
RETURN c.context_id AS id, c.role AS role, c.grade AS grade,
       c.company_industry AS industry, c.company_size AS size
```
- Для чего: расширить информацию о контексте.
- Как: добавление полей в `RETURN`.

**Шаг 1.5** — Показываем технологии из списков
```cypher
MATCH (c:Context)
WHERE c.context_id = 'ctx1'
RETURN c.context_id AS id, c.role AS role,
       c.languages AS langs, c.databases AS dbs, c.cloud AS cloud_tech
```
- Для чего: посмотреть технологии контекста.
- Как: возврат списков как есть.

---

### 2) Фильтрация по свойствам и спискам (пошаговая прогрессия)

**Шаг 2.1** — Фильтр по точной индустрии
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c.context_id AS id, c.role AS role, c.company_industry AS industry
```
- Для чего: найти все контексты в fintech (все 3 тестовых контекста).
- Как: `WHERE prop = value`.

**Шаг 2.2** — Добавляем фильтр по размеру компании
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech' AND c.company_size = 'large'
RETURN c.context_id AS id, c.role AS role, c.company_size AS size
```
- Для чего: только крупные компании в fintech (ctx1).
- Как: комбинирование условий через `AND`.

**Шаг 2.3** — Фильтр по роли (регистронезависимо)
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech' 
  AND toLower(c.role) CONTAINS 'developer'
RETURN c.context_id AS id, c.role AS role
```
- Для чего: все разработчики в fintech (ctx1, ctx2, ctx3).
- Как: `toLower(...) CONTAINS ...`.

**Шаг 2.4** — Фильтр по технологиям в списке
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech' 
  AND 'typescript' IN c.languages
RETURN c.context_id AS id, c.role AS role, c.languages AS langs
```
- Для чего: контексты с TypeScript (ctx1, ctx2).
- Как: оператор `IN` для списков.

**Шаг 2.5** — Фильтр по базе данных
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech' 
  AND 'postgresql' IN c.databases
RETURN c.context_id AS id, c.role AS role, c.databases AS dbs
```
- Для чего: контексты с PostgreSQL (только ctx1).
- Как: `IN` для поиска в списке.

**Шаг 2.6** — Фильтр по доменам работы
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech' 
  AND 'Backend' IN c.domains_covered
RETURN c.context_id AS id, c.role AS role, c.domains_covered AS domains
```
- Для чего: контексты с Backend (ctx1, ctx2).
- Как: `IN` для списка доменов.

**Шаг 2.7** — Комбинированный фильтр: Frontend + React
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech' 
  AND 'Frontend' IN c.domains_covered
  AND 'react' IN c.frameworks
RETURN c.context_id AS id, c.role AS role, c.frameworks AS frameworks
```
- Для чего: Frontend-разработчики с React (ctx2, ctx3).
- Как: множественные условия `AND`.

---

### 3) Возврат полей и проекции (пошаговая прогрессия)

**Шаг 3.1** — Базовая проекция для всех fintech контекстов
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c.context_id AS id, c.role AS role, c.grade AS grade
```
- Для чего: компактный обзор всех fintech контекстов.
- Как: явный список полей в `RETURN`.

**Шаг 3.2** — Добавляем информацию о компании
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c.context_id AS id, c.role AS role, c.grade AS grade,
       c.company_size AS size, c.role_started_at AS started
```
- Для чего: расширить информацию о контексте.
- Как: добавление полей в `RETURN`.

**Шаг 3.3** — Map-проекция для компактного JSON
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c{ .context_id, .role, .grade, .company_size, .role_started_at } AS ctx
```
- Для чего: собрать компактный JSON-объект.
- Как: `c{ ... }` синтаксис для проекции.

**Шаг 3.4** — Добавляем срезы списков
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c{ .context_id, .role, .grade, 
          domains: c.domains_covered[0..2], 
          langs: c.languages[0..3] } AS ctx
```
- Для чего: показать первые элементы списков.
- Как: срезы `[0..2]` для ограничения размера списков.

**Шаг 3.5** — Проекция с вычислениями
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c{ .context_id, .role, .grade,
          tech_count: size(c.languages) + size(c.frameworks) + size(c.databases),
          has_cloud: size(c.cloud) > 0,
          is_senior: c.grade = 'Senior' } AS ctx
```
- Для чего: добавить вычисляемые поля.
- Как: функции `size(...)` и логические выражения.

**Шаг 3.6** — Полная проекция с переименованием
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
RETURN c{ .context_id, .role, .grade,
          company_info: { size: c.company_size, industry: c.company_industry },
          tech_stack: { languages: c.languages, databases: c.databases },
          domains: c.domains_covered } AS ctx
```
- Для чего: структурированная проекция с вложенными объектами.
- Как: создание вложенных структур в проекции.

---

### 4) Сортировка, пагинация

**Что такое `WITH`:**
- `WITH` = "возьми эти данные и передай в следующую часть запроса"
- Позволяет делать вычисления между `MATCH` и `RETURN`
- Можно переименовывать поля: `WITH c, c.role AS role_name`
- Можно фильтровать: `WITH c WHERE c.grade = 'Senior'`

4.1 Базовая сортировка
```cypher
MATCH (c:Context)
RETURN c
ORDER BY c.role_started_at DESC
LIMIT 25
```
- Для чего: последние роли первыми.
- Как: `ORDER BY ... DESC`.

4.2 Стабильная сортировка и пагинация
```cypher
MATCH (c:Context)
RETURN c
ORDER BY c.role_started_at DESC, c.context_id ASC
SKIP $offset LIMIT $limit
```
- Для чего: стабильная страница результатов.
- Как: несколько ключей сортировки + `SKIP/LIMIT`.

**Альтернатива без параметров (для быстрого тестирования):**
```cypher
MATCH (c:Context)
RETURN c
ORDER BY c.role_started_at DESC, c.context_id ASC
SKIP 0 LIMIT 10
```

4.3 Сортировка по вычисленной дате

**Когда нужен `date()`:**
- Для простой сортировки: `ORDER BY c.role_started_at DESC` — достаточно
- Для вычислений: `date(c.role_started_at + '-01')` — обязательно

**Пример: расчет стажа в месяцах**
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
WITH c, date(c.role_started_at + '-01') AS started_date
RETURN c.context_id AS id, c.role AS role,
       duration.inDays(started_date, date()).days AS days_in_role
ORDER BY days_in_role DESC
```
- **Зачем**: посчитать стаж в днях
- **Как**: `c.role_started_at + '-01'` превращает `"2024-12"` в `"2024-12-01"`
- **`.days`**: извлекает число дней из объекта Duration (проще чем `.months`)

**Почему `-01`:**
- `date("2024-12")` → `null` (ошибка!)
- `date("2024-12-01")` → правильная дата

---

### 5) OPTIONAL MATCH и устойчивые запросы

5.1 Nullable-справочник Grade
```cypher
MATCH (c:Context)
OPTIONAL MATCH (c)-[:HAS_GRADE]->(g:Grade)
RETURN c.context_id AS id, coalesce(g.name, '—') AS grade
LIMIT 25
```
- Для чего: не падать, если связи нет.
- Как: `OPTIONAL MATCH` + `coalesce(...)`.

5.2 Nullable-Industry
```cypher
MATCH (c:Context)
OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
RETURN c.context_id AS id, i.name AS industry
LIMIT 25
```
- Для чего: безопасно возвращать индустрию.
- Как: `OPTIONAL MATCH`.

5.3 Подсчет связанных сущностей
```cypher
MATCH (c:Context)
OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
RETURN c.context_id AS id, count(s) AS skills_cnt
ORDER BY skills_cnt DESC
LIMIT 25
```
- Для чего: метрики по связям.
- Как: `count(...)` с `OPTIONAL MATCH`.

---

### 6) Переменная длина пути и «окрестности»

6.1 Окрестность контекста
```cypher
MATCH p = (c:Context {context_id: $ctxId})-[*1..2]-(m)
RETURN p
LIMIT 25
```
- Для чего: быстрый обзор соседей.
- Как: `[*1..2]` — пути переменной длины.

6.2 Дорога до категорий навыков
```cypher
MATCH p = (c:Context)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
RETURN p
LIMIT 25
```
- Для чего: понять структуру навыков.
- Как: цепочка из 2-х связей.

6.3 Фильтр на конечные метки
```cypher
MATCH p = (c:Context)-[*1..2]->(ref)
WHERE any(l IN labels(ref) WHERE l IN ['Role','Industry','WorkDomain','Skill'])
RETURN p
LIMIT 25
```
- Для чего: показывать только понятные справочники.
- Как: `labels(...)` + `any(...)`.

---

### 7) Агрегации и группировки

7.1 Контексты на пользователя
```cypher
MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
RETURN u.user_id AS user, count(*) AS contexts
ORDER BY contexts DESC
```
- Для чего: «насколько много контекстов у пользователя».
- Как: `count(*)`, `GROUP BY` не нужен — по полям в `RETURN`.

7.2 Топ навыков
```cypher
MATCH (c:Context)-[:USES_SKILL]->(s:Skill)
RETURN s.name AS skill, count(*) AS uses
ORDER BY uses DESC
LIMIT 10
```
- Для чего: частотность навыков.
- Как: агрегация по `Skill`.

7.3 Топ языков из свойства-списка
```cypher
MATCH (c:Context) UNWIND c.languages AS lang
RETURN lang, count(*) AS uses
ORDER BY uses DESC
LIMIT 10
```
- Для чего: частотность по массиву.
- Как: `UNWIND` разворачивает список в строки.

---

### 8) Работа со списками и предикатами

8.1 Предикаты any/all/none/single
```cypher
MATCH (c:Context)
WHERE any(d IN c.domains_covered WHERE d IN ['Backend','Data'])
RETURN c

MATCH (c:Context)
WHERE all(t IN c.testing_tools WHERE NOT t CONTAINS 'legacy')
RETURN c

MATCH (c:Context)
WHERE none(lib IN c.libraries WHERE lib CONTAINS 'left-pad')
RETURN c

MATCH (c:Context)
WHERE single(fr IN c.frameworks WHERE fr CONTAINS 'react')
RETURN c
```
- Для чего: гибкая фильтрация содержимого списков.
- Как: список-предикаты.

8.2 Работа с `UNWIND`: подсчет уникального
```cypher
MATCH (c:Context)
UNWIND c.devops_tools AS tool
WITH tool, count(*) AS cnt
RETURN tool, cnt
ORDER BY cnt DESC
```
- Для чего: агрегировать элементы списков.
- Как: `UNWIND` + агрегирование.

8.3 Сбор уникальных значений
```cypher
MATCH (c:Context)-[:USES_SKILL]->(s:Skill)
RETURN c.context_id AS id, collect(DISTINCT s.name) AS skills
LIMIT 25
```
- Для чего: убрать дубликаты.
- Как: `collect(DISTINCT ...)`.

---

### 9) Подзапросы CALL { … }

9.1 Коррелированный подзапрос: топ навыков к каждому контексту
```cypher
MATCH (c:Context)
CALL {
  WITH c
  MATCH (c)-[:USES_SKILL]->(s:Skill)
  RETURN collect(s.name)[0..5] AS top5
}
RETURN c.context_id AS id, top5
LIMIT 25
```
- Для чего: локальная агрегация для каждой сущности.
- Как: `CALL { WITH c ... } RETURN ...`.

9.2 Подзапрос для вычисления метрик
```cypher
MATCH (c:Context)
CALL {
  WITH c
  MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
  RETURN count(wd) AS domains_cnt
}
RETURN c.context_id AS id, domains_cnt
ORDER BY domains_cnt DESC
LIMIT 25
```
- Для чего: изолировать логику вычисления.
- Как: подзапрос возвращает отдельные колонки.

9.3 Подзапрос с фильтром по тексту
```cypher
MATCH (c:Context)
CALL {
  WITH c
  MATCH (c)-[:USES_SKILL]->(s:Skill)
  WHERE s.name CONTAINS 'sql'
  RETURN count(*) AS sql_hits
}
WHERE sql_hits > 0
RETURN c.context_id AS id, sql_hits
```
- Для чего: фильтрация через результаты подзапроса.
- Как: `WHERE` после `CALL {}` по возвращенным полям.

---

### 10) Даты и время

10.1 Преобразование `YYYY-MM` в дату и расчет стажа
```cypher
MATCH (c:Context)
WHERE c.role_started_at IS NOT NULL
WITH c, date(c.role_started_at + '-01') AS started
RETURN c.context_id AS id,
       duration.inMonths(started, date()).months AS months_in_role
ORDER BY months_in_role DESC
LIMIT 25
```
- Для чего: стаж в месяцах.
- Как: `date(...)` + `duration.inMonths(...)`.

10.2 Фильтр по диапазону месяцев
```cypher
MATCH (c:Context)
WHERE c.role_started_at >= '2023-01' AND c.role_started_at <= '2024-12'
RETURN c
ORDER BY c.role_started_at DESC
```
- Для чего: отбор по интервалу.
- Как: строки формата `YYYY-MM` сравниваются лексикографически корректно.

10.3 Период работы (если есть `period_start`/`period_end`)
```cypher
MATCH (c:Context)
WITH c,
     coalesce(c.period_start, c.role_started_at + '-01') AS startStr,
     coalesce(c.period_end, toString(date())) AS endStr
WITH c, date(startStr) AS startD, date(endStr) AS endD
RETURN c.context_id AS id, duration.between(startD, endD).months AS months
ORDER BY months DESC
LIMIT 25
```
- Для чего: длительность по периоду.
- Как: `coalesce`, `duration.between(...)`.

---

### 11) Наличие шаблонов (EXISTS { … })

11.1 Проверка связи на существование
```cypher
MATCH (c:Context)
WHERE EXISTS {
  MATCH (c)-[:IN_ROLE]->(:Role {name: 'Backend Developer'})
}
RETURN c
```
- Для чего: отобрать узлы с конкретной связью.
- Как: `EXISTS { MATCH ... }`.

11.2 Проверка хотя бы одного навыка из набора
```cypher
MATCH (c:Context)
WHERE EXISTS {
  MATCH (c)-[:USES_SKILL]->(s:Skill)
  WHERE s.name IN ['sql','postgres','neo4j']
}
RETURN c
```
- Для чего: условие «хотя бы один релевантный навык».
- Как: `EXISTS` с внутренним `MATCH`.

11.3 Комбинация свойств и паттернов
```cypher
MATCH (c:Context)
WHERE c.company_industry = 'fintech'
  AND EXISTS { MATCH (c)-[:IN_WORK_DOMAIN]->(:WorkDomain {name: 'Backend'}) }
RETURN c
```
- Для чего: сочетание фильтров по данным и по структуре.
- Как: комбинирование `WHERE` и `EXISTS`.

---

### 12) Производительность: EXPLAIN/PROFILE, индексы, подсказки

12.1 План выполнения без исполнения
```cypher
EXPLAIN
MATCH (c:Context)
WHERE c.role = $role
RETURN c
```
- Для чего: посмотреть план, не выполняя запрос.
- Как: префикс `EXPLAIN`.

12.2 Профилирование с фактическими метриками
```cypher
PROFILE
MATCH (c:Context)
WHERE c.role = $role
RETURN c
```
- Для чего: видеть реальную статистику выполнения.
- Как: префикс `PROFILE`.

12.3 Просмотр индексов и ограничений
```cypher
SHOW INDEXES
YIELD name, type, entityType, labelsOrTypes, properties
RETURN name, type, entityType, labelsOrTypes, properties;

SHOW CONSTRAINTS
YIELD name, type, entityType, labelsOrTypes, properties
RETURN name, type, entityType, labelsOrTypes, properties;
```
- Для чего: понять, какие индексы/уники есть.
- Как: команды `SHOW ...`.

12.4 Хинт явного использования индекса (редко нужен)
```cypher
MATCH (c:Context)
USING INDEX c:Context(role)
WHERE c.role = $role
RETURN c
```
- Для чего: насильно направить планировщик.
- Как: `USING INDEX`. Обычно не требуется.

---

### 13) Полнотекстовый поиск (опционально, если настроен индекс)

13.1 Создание FTS индекса (административно)
```cypher
CALL db.index.fulltext.createNodeIndex(
  'context_role_ft',
  ['Context'],
  ['role']
)
```
- Для чего: быстрый поиск по тексту роли.
- Как: `db.index.fulltext.createNodeIndex`.

13.2 Запрос к FTS индексу
```cypher
CALL db.index.fulltext.queryNodes('context_role_ft', $q) YIELD node, score
RETURN node.context_id AS id, node.role AS role, score
ORDER BY score DESC
LIMIT 25
```
- Для чего: релевантная выдача по тексту.
- Как: `queryNodes(...)`.

---

### 14) Запись данных: CREATE/MERGE/SET/FOREACH

14.1 Создать связь пользователя с контекстом
```cypher
MATCH (u:User {user_id: $userId})
MATCH (c:Context {context_id: $ctxId})
MERGE (u)-[r:HAS_CONTEXT]->(c)
SET r.is_current = true
RETURN r
```
- Для чего: связать уже существующие узлы.
- Как: `MERGE` на связь + `SET` свойств.

14.2 Привязать роль и домены (идемпотентно)
```cypher
MATCH (c:Context {context_id: $ctxId})
MERGE (r:Role {name: $role})
MERGE (c)-[:IN_ROLE]->(r)
WITH c
UNWIND $domains AS d
MERGE (wd:WorkDomain {name: d})
MERGE (c)-[:IN_WORK_DOMAIN]->(wd)
RETURN c
```
- Для чего: аккуратно добавлять справочники.
- Как: `MERGE` + `UNWIND`.

14.3 Массовое создание навыков из списков свойств
```cypher
MATCH (c:Context {context_id: $ctxId})
WITH c, c.languages + c.runtimes + c.frameworks + c.libraries + c.databases + c.cloud + c.devops_tools + c.testing_tools + c.skills_hard AS allSkills
UNWIND allSkills AS name
WITH c, trim(toLower(name)) AS n
WHERE n <> ''
MERGE (s:Skill {name: n})
MERGE (c)-[:USES_SKILL]->(s)
RETURN c, count(*) AS linked
```
- Для чего: нормализация свойств в явные узлы `Skill`.
- Как: конкатенация списков, `UNWIND`, `MERGE`.

---

### 15) Безопасные обновления и удаление

15.1 Обновление свойства
```cypher
MATCH (c:Context {context_id: $ctxId})
SET c.company_size = $size
RETURN c
```
- Для чего: точечное обновление.
- Как: `SET`.

15.2 «Мягкое» удаление связи (через флаг)
```cypher
MATCH (u:User {user_id: $userId})-[r:HAS_CONTEXT]->(c:Context {context_id: $ctxId})
SET r.is_current = false
RETURN r
```
- Для чего: не ломать историю.
- Как: обновление свойства на ребре.

15.3 Полное удаление (осторожно!)
```cypher
// Удалить только связь
MATCH (u:User {user_id: $userId})-[r:HAS_CONTEXT]->(c:Context {context_id: $ctxId})
DELETE r;

// Удалить узел с каскадным удалением связей
MATCH (c:Context {context_id: $ctxId})
DETACH DELETE c;
```
- Для чего: cleanup.
- Как: `DELETE` для ребра, `DETACH DELETE` для узла.

---

## Практические «срезы» для твоих 3 контекстов (test-context-1/2/3.json)

### A) Пошаговое сравнение контекстов

**A.1** — Базовое сравнение всех контекстов
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN c.context_id AS id, c.role AS role, c.grade AS grade, c.company_size AS size
ORDER BY c.context_id
```

**A.2** — Добавляем технологии
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN c.context_id AS id, c.role AS role, c.grade AS grade,
       c.languages AS langs, c.frameworks AS frameworks, c.databases AS dbs
ORDER BY c.context_id
```

**A.3** — Сравнение по доменам работы
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN c.context_id AS id, c.role AS role,
       c.domains_covered AS domains,
       size(c.domains_covered) AS domains_count
ORDER BY domains_count DESC
```

### B) Анализ технологических стеков

**B.1** — Кто использует TypeScript
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
  AND 'typescript' IN c.languages
RETURN c.context_id AS id, c.role AS role, c.languages AS langs
```

**B.2** — Кто использует React
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
  AND 'react' IN c.frameworks
RETURN c.context_id AS id, c.role AS role, c.frameworks AS frameworks
```

**B.3** — Сравнение баз данных
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN c.context_id AS id, c.role AS role,
       c.databases AS dbs,
       CASE WHEN size(c.databases) = 0 THEN 'No DB' ELSE 'Has DB' END AS db_status
ORDER BY c.context_id
```

### C) Анализ по грейдам и опыту

**C.1** — Сортировка по грейдам
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN c.context_id AS id, c.role AS role, c.grade AS grade, c.role_started_at AS started
ORDER BY 
  CASE c.grade 
    WHEN 'Senior' THEN 3 
    WHEN 'Middle' THEN 2 
    WHEN 'Junior' THEN 1 
    ELSE 0 
  END DESC
```

**C.2** — Анализ стажа (если есть даты)
```cypher
MATCH (c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
  AND c.role_started_at IS NOT NULL
WITH c, date(c.role_started_at + '-01') AS started
RETURN c.context_id AS id, c.role AS role, c.grade AS grade,
       started AS start_date,
       duration.inMonths(started, date()).months AS months_in_role
ORDER BY months_in_role DESC
```

### D) Связи с пользователями (если есть)

**D.1** — Контексты пользователей
```cypher
MATCH (u:User)-[r:HAS_CONTEXT]->(c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN u.user_id AS user, c.context_id AS ctx, c.role AS role, r.is_current AS current
ORDER BY u.user_id, c.context_id
```

**D.2** — Текущие контексты
```cypher
MATCH (u:User)-[r:HAS_CONTEXT {is_current: true}]->(c:Context)
WHERE c.context_id IN ['ctx1', 'ctx2', 'ctx3']
RETURN u.user_id AS user, c.context_id AS ctx, c.role AS role
ORDER BY u.user_id
```

---

## Подсказки и лучшие практики

- Используй `EXPLAIN/PROFILE` для тяжелых запросов (секция 12).
- Для строковых месяцев `YYYY-MM` конвертируй в `date(...)` при вычислениях (секция 10).
- `OPTIONAL MATCH` + `coalesce(...)` для устойчивости (секция 5).
- Избегай дубликатов с `MERGE`, а не `CREATE` (секция 14).
- Для списков — `UNWIND`, `collect(DISTINCT ...)`, предикаты `any/all/none/single` (секция 8).
- Интроспекция: `SHOW INDEXES`, `SHOW CONSTRAINTS` (секция 12).