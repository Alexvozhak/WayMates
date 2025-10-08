# WayMates MVP: минимальный план отработки схем и поиска когорты

Дата: 2025‑09‑22

> **Scope (минимальный план):** без MCP/HTTP и без Telegram/LangGraph. Только локальные скрипты `persist.ts` и `search_cohort.ts` на `neo4j-driver`. Fallback GraphCypherQAChain — отложен.

## 1) Цели итерации (минимум)
- Отработать локально Neo4j (поднять БД, залогиниться, выполнить `init.cypher`).
- Утвердить минимальную JSON‑схему (weak/strict) для текущего контекста и истории.
- Утвердить Cypher‑схему: допустимые узлы/связи, констрейнты и индексы.
- Отрепетировать идемпотентный `persist` (JSON → Cypher → Neo4j).
- Реализовать и проверить базовый поиск когорты и аватаров по правилам MVP.

## 2) Локальный запуск Neo4j

### Вариант A — Docker (рекомендуется)
```bash
docker run -d \
  --name waymates-neo4j \
  --network host \
  -e NEO4J_AUTH=neo4j/neo4jtest \
  -v $HOME/neo4j/waymates/data:/data \
  -v $HOME/neo4j/waymates/logs:/logs \
  -v $HOME/neo4j/waymates/import:/var/lib/neo4j/import \
  neo4j:latest
```

- UI: http://localhost:7474 (логин/пароль: `neo4j` / `neo4jtest`)
- Bolt: `bolt://localhost:7687`

Загрузка init-скрипта:
```bash
# Поместите файл init.cypher в $HOME/neo4j/waymates/import
docker exec -it waymates-neo4j cypher-shell -u neo4j -p neo4jtest -f /var/lib/neo4j/import/init.cypher
```

### Вариант B — Neo4j Desktop
- Создать «Local DBMS», выбрать версию 5.x, задать пароль, стартовать кластер.
- Выполнить `init.cypher` через встроенный «Query» редактор.

## 3) Инициализация схемы (init.cypher)

### Констрейнты (идемпотентно)
```cypher
// Уникальные идентификаторы доменных сущностей
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User)
REQUIRE u.user_id IS UNIQUE;

CREATE CONSTRAINT context_id_unique IF NOT EXISTS FOR (c:Context)
REQUIRE c.context_id IS UNIQUE;
```

### Индексы для фильтров когорты
```cypher
// Быстрые равенства по фильтрам
CREATE INDEX context_role IF NOT EXISTS FOR (c:Context) ON (c.role);
// Опционально: индекс по дате старта роли (если понадобится)
CREATE INDEX context_role_started_at IF NOT EXISTS FOR (c:Context) ON (c.role_started_at);
```

## 4) Минимальная JSON‑схема (weak/strict)

Принцип: базовая схема максимально опциональна; «строгость» задаём пост‑валидацией.

- Weak (импорт с внешних источников): проверяем типы/форматы, `required` почти нет.
- Strict (ручной ввод/Telegram): требуем минимум для поиска когорты.

Минимальный набор для Strict (контекст пользователя «текущий»):
- `user_id` (string)
- `contexts[0]` (текущий):
  - `context_id` (string)
  - `role` (string)
  - `company.industry` → сохраняем как `company_industry` (string, опционально для фильтров MVP)
  - `domains_covered[]` (string[]; ≥1, значения из ограниченного списка)
  - `tech.languages[]`, `tech.frameworks[]`, `tech.runtimes[]`, `tech.libraries[]`, `databases[]`, `cloud[]`, `devops_tools[]`, `testing_tools[]` (все опциональны; lowercased)
  - `skills_hard[]` (опционально; lowercased)
  - `role_started_at` (YYYY‑MM; обязательно)

Пример полезной нормализации в persist:
- lowercasing для всех тех‑категорий и `skills_hard[]`
- `company_industry` = lowercased (опционально для хранения)
- `domains_covered[]` = canonical TitleCase (например, `Backend`, `Frontend`, `Architecture`)
- Стаж в роли не храним, считаем в запросе из `role_started_at`

## 5) JSON → Cypher (идемпотентный persist)

Основные узлы и ключи:
- `(User {user_id})`
- `(Context {context_id})` — хранит свойства текущего контекста (см. ниже)

Рекомендуемые свойства `Context`:
- `role`, `grade`
- `company_industry`, `company_size`
- `domains_covered[]`
- Тех‑категории по отдельности: `languages[]`, `runtimes[]`, `frameworks[]`, `libraries[]`, `databases[]`, `cloud[]`, `devops_tools[]`, `testing_tools[]`
- `skills_hard[]` (доп. хард‑навыки)
- `role_started_at` (YYYY‑MM)
- `period_start` (YYYY‑MM), `period_end` (nullable)
- прочие поля по необходимости (work_type, schedule, team_size, stage)

Идемпотентный upsert (упрощённо, без `MainStory`):
```cypher
// User
MERGE (u:User {user_id: $user_id});

// Context
MERGE (c:Context {context_id: $current_context.context_id})
  ON CREATE SET c.created_at = datetime()
SET c.role = $current_context.role,
    c.grade = $current_context.grade,
    c.company_industry = $current_context.company_industry,
    c.company_size = $current_context.company_size,
    c.domains_covered = $current_context.domains_covered,
    c.languages = $current_context.languages,
    c.runtimes = $current_context.runtimes,
    c.frameworks = $current_context.frameworks,
    c.libraries = $current_context.libraries,
    c.databases = $current_context.databases,
    c.cloud = $current_context.cloud,
    c.devops_tools = $current_context.devops_tools,
    c.testing_tools = $current_context.testing_tools,
    c.skills_hard = $current_context.skills_hard,
    c.role_started_at = $current_context.role_started_at,
    c.period_start = $current_context.period_start,
    c.period_end = $current_context.period_end;

MERGE (u)-[r:HAS_CONTEXT]->(c)
SET r.is_current = true;
```

Тропы исключены из MVP (будут добавлены позже).

Нормализация (в приложении перед записью):
- lowercasing для skills/industry
- канонизация доменов (`Backend`, `Frontend`, `Architecture`, ...)
- стаж не сохраняем; считаем в запросе из `role_started_at`

## 6) Поиск когорты и аватаров (MVP)

Параметры:
- `$role` (string)
- `$userDomains[]` (string[]), `$userSkills[]` (string[])
- `$userRoleExp` (float, годы)
- `$minCoverage` (float), `$expTolerance` (float, годы)
- `$limit` (int)

Запрос когорты (базовый фильтр + ранжирование; без фильтра по индустрии):
```cypher
WITH $role AS role,
     $userDomains AS userDomains,
     $userSkills AS userSkills,
     $userRoleExp AS userRoleExp,
     $minCoverage AS minCoverage,
     $expTolerance AS expTolerance,
     $limit AS limit

MATCH (u:User)-[r:HAS_CONTEXT]->(c:Context)
WHERE r.is_current = true
  AND c.role = role
  AND size([d IN c.domains_covered WHERE d IN userDomains]) >= 1

WITH c, userSkills, userRoleExp, minCoverage, expTolerance, limit,
     size([s IN (coalesce(c.languages, []) + coalesce(c.runtimes, []) + coalesce(c.frameworks, []) +
                 coalesce(c.libraries, []) + coalesce(c.databases, []) + coalesce(c.cloud, []) +
                 coalesce(c.devops_tools, []) + coalesce(c.testing_tools, []) + coalesce(c.skills_hard, []))
           WHERE s IN userSkills]) AS matchedSkills,
     size(userSkills) AS userSkillsCount,
     size([d IN c.domains_covered WHERE d IN $userDomains]) AS domainOverlap,
     // вычисляем стаж кандидата в годах из role_started_at (формат YYYY-MM)
     toFloat(duration.inMonths(
       date(),
       date({year: toInteger(split(c.role_started_at,'-')[0]), month: toInteger(split(c.role_started_at,'-')[1])})
     ).months) / 12.0 AS candidateExpYears

WITH c, matchedSkills,
     (CASE WHEN userSkillsCount = 0 THEN 0.0 ELSE toFloat(matchedSkills)/userSkillsCount END) AS coverage,
     (CASE WHEN domainOverlap > 0 THEN 1 ELSE 0 END) AS domainMatch,
     abs(candidateExpYears - userRoleExp) AS expDelta,
     minCoverage, expTolerance, limit

WHERE coverage >= minCoverage AND expDelta <= expTolerance

RETURN c.context_id AS context_id,
       matchedSkills,
       coverage,
       domainMatch,
       expDelta,
       c AS context
ORDER BY matchedSkills DESC, coverage DESC, domainMatch DESC, expDelta ASC
LIMIT limit;
```

Адаптивная логика (снаружи, в коде):
1) `minCoverage`: 0.8 → 0.6 → 0.4 → 0.0
2) `expTolerance`: ±1 → ±2 → без ограничения
3) снять домены
4) индустрия: (убрана из MVP)
5) роль: exact → family → adjacent

«Аватары» = когорты, у которых есть желаемый целевой контекст; в MVP фиксируем только когорту.

## 7) JSON → Cypher или JSON → YAML → Cypher?

### JSON → Cypher (рекомендуется для MVP)
**Плюсы:**
- Одно представление для API и БД, меньше преобразований.
- Проще валидировать (AJV), проще логировать и отлаживать.
- Меньше рисков рассинхронизации типов.

**Минусы:**
- Менее удобен для ручного редактирования (чем YAML).

### JSON → YAML → Cypher (опционально для ручных ревью)
**Плюсы:**
- Удобнее читать/ревьюить глазами, комментировать.

**Минусы:**
- Дополнительный шаг конвертации, новые классы ошибок.
- Риск потери точных типов/форматов при «ручной» правке.

👉 Решение: для MVP используем только JSON → Cypher. YAML оставляем как «человеко‑читаемый экспорт» по необходимости (не в контурах записи).

## 8) Чеклист репетиции (ручной прогон)
1. Поднять Neo4j (Docker/Desktop).
2. Выполнить `init.cypher` (констрейнты/индексы).
3. Подготовить 2–3 тестовых JSON с текущими контекстами (разные роли/домены).
4. Нормализовать JSON: привести тех‑категории к lowercased, убедиться в наличии `role_started_at`.
5. Выполнить `persist` (скрипт или ручной `MERGE` в Browser).
6. Запустить запрос когорты с разными порогами `minCoverage`/`expTolerance`.
7. Зафиксировать наблюдения: сколько результатов, распределения coverage/expDelta.

## 9) Риски и допущения
- Без APOC: все операции делаем чистым Cypher (переносимо, просто).
- Индексация покрывает только равенства и числовой диапазон; пересечения массивов считаем на лету (при малом объёме данных ок).
- Нормализация навыков (синонимы, регистры) — на стороне приложения.
- Конфиденциальность/доступы — вне рамок этой итерации.

## 10) Следующие шаги (после согласования)
- Добавить небольшой Node.js скрипт `persist.ts` (Fastify не обязателен для репетиции) для JSON → Cypher.
- Добавить `search_cohort.ts`: параметризованный Cypher + авто‑тюнер порогов (coverage 0.8→0.6→0.4→0.0; опыт ±1→±2→∞; снять домены).
- Подготовить «минимальный набор» тестовых данных из `memory-bank/schemas.md`.
- Собрать метрики для калибровки порогов (coverage, expDelta) и зафиксировать.



## Обновления 2025-09-24 (Чистый граф, поиск, индексы)

- Чистый граф: массивы в `Context` (languages, runtimes, frameworks, libraries, databases, cloud, devops_tools, testing_tools, skills_hard, domains_covered и т.п.) больше НЕ сохраняем как свойства узла. Источником истины являются связи: `(:Context)-[:IN_ROLE]->(:Role)`, `[:HAS_GRADE]->(:Grade)`, `[:IN_INDUSTRY]->(:Industry)`, `[:IN_WORK_DOMAIN]->(:WorkDomain)`, `[:USES_SKILL]->(:Skill)`.
- Свойства `Context`, которые храним: `context_id`, `role_started_at`, `period_start`, `period_end`, `created_at`.
- Индексы: индекс `context_role` удалён; оставляем индекс по `c.role_started_at` для расчётов опыта.
- Поиск: ведём по ВСЕМ контекстам (без `currentOnly`), матч ролей/доменов/скиллов — только через связи.
- Лестница порогов (MVP, старт): coverage 0.8 → 0.6 → 0.4 → 0.0; опыт ±1 → ±2 → ∞; домены on → off.

## 11) Вопросы на согласование и ответы (заполнять по мере решения)

1) JSON → YAML → Cypher или только JSON → Cypher?
- Варианты:
  - [x] JSON → Cypher (MVP, дефолт — проще и быстрее)
  - [ ] JSON → YAML → Cypher (только для ручных ревью/экспорта)
- Предложение: использовать только JSON → Cypher в этой итерации. YAML‑экспорт при необходимости позже.
- Ответ: ок
2) Объём данных на MVP: только «текущий» контекст или вся история?
- Варианты:
  - [x] Только текущий `Context` (без истории) — минимально достаточно для когорты
  - [ ] Сразу добавлять историю (прошлые контексты)
- Предложение: оставить только текущий контекст.
- Ответ:ок

3) Схема связей: нужен ли `MainStory` как обёртка?
- Варианты:
  - [x] Без `MainStory` в MVP: `User` —[:HAS_CONTEXT {is_current:true}]→ `Context`
  - [ ] С `MainStory` (для будущей хронологии)
- Предложение: не вводить `MainStory` в MVP, чтобы избежать лишних обходов. Историю добавим позже.
- Ответ: ок

4) Нужно ли требовать стаж в роли для фильтрации (± годы)?
- Пояснение: фильтр использует `role_experience_years` (или вычисляет его из `role_started_at`).
- Варианты:
  - [x] В strict требовать одно из: `role_started_at` (YYYY‑MM) ИЛИ `role_experience_years` (число)
  - [ ] Сделать стаж опциональным и временно не использовать фильтр по стажу
- Предложение: требовать одно из двух. Если нет ни одного — пропускаем фильтр по стажу.
- Ответ:  role_experience_years - не нужно, делаем role_started_at обязательным.

5) Нормализация навыков: карта синонимов или AI?
- Варианты:
  - [x] MVP: lowercase. AI приводит к существующим терминам; новые создаём только если нет матча
  - [ ] Постоянная ручная карта синонимов
- Предложение: согласен с AI‑подходом. На MVP — только lowercase; периодически собирать список distinct для подсказок AI.
- Ответ: ок

6) Что такое `skills_current[]` и зачем объединять?
- Пояснение: `skills_current[]` — объединение всех тех‑категорий (`languages`, `runtimes`, `frameworks`, `libraries`, `databases`, `cloud`, `devops_tools`, `testing_tools`) и `skills_hard[]` в один массив для простого матчинга.
- Пример:
  ```text
  skills_current = toLowerCase(
    languages ∪ runtimes ∪ frameworks ∪ libraries ∪ databases ∪ cloud ∪ devops_tools ∪ testing_tools ∪ skills_hard
  )
  ```
- Варианты:
  - [x] Делать объединение в одно поле (проще ранжировать по coverage)
  - [ ] Держать категории раздельно и матчить покатегорийно
- Предложение: объединение в одно поле на MVP.
- Ответ: не объединять. Держим категории раздельно. Софт‑скиллы пока не учитываем в матчинг; добавим позже отдельным полем `skills_soft[]` и отдельной логикой ранжирования.

7) Домены: «закрытый список» или свободный текст?
- Пояснение: «закрытый список» = перечисление допустимых значений в коде (enum), например: `Backend`, `Frontend`, `Architecture`, `Data`, `DevOps`, `Mobile`, `QA`, `SRE`.
- Варианты:
  - [x] Закрытый список (enum) + маппинг синонимов позже через AI
  - [ ] Свободный ввод строк
- Предложение: закрытый enum в коде.
- Ответ: ок

8) Индустрия: exact‑match или маппинг в макросектора?
- Варианты:
  - [x] MVP: exact match (lowercased строка)
  - [ ] Маппинг в макросектора (например, `fintech → finance`) позже
- Предложение: exact сейчас; макросектора — последующим шагом.
- Ответ: пока непонятно. Нужны примеры. Примеры: adtech→advertising, insurtech→insurance, medtech→healthcare, govtech→public sector, proptech→real estate, edtech→education, agritech→agriculture.

9) Пороги поиска (thresholds):
- Пояснение:
  - `minCoverage` — доля совпавших навыков (matched/все твои)
  - `expTolerance` — допустимая разница в стаже (в годах)
- Дефолты (предложение): `minCoverage=0.6`, `expTolerance=1.0`, `limit=100` (лимит количества возвращаемых контекстов)
- Ослабление при дефиците: coverage 0.8→0.6→0.4→0.0; стаж ±1→±2→∞; далее снимать домены, расширять индустрию/роль.
- Ответ: ок

10) Индексы: зачем и какие именно?
- Пояснение: ускоряют базовые фильтры когорты: равенства по `role`, `company_industry`, композит `(role, company_industry)` и диапазон по `role_experience_years`.
- Вопрос про `domains_covered`: B‑Tree индекс не ускорит проверку «есть пересечение массивов». Для ускорения можно было бы нормализовать домены в отдельные узлы `(Domain)` и связи, но это сложнее. На MVP — без индекса по массиву.
- Предложение: оставить предложенные индексы, без индекса на `domains_covered`.
- Ответ: ок

11) Дедуп/идемпотентность:
- Пояснение: уникальные констрейнты по ID и композит `(skill, platform)` + `MERGE` дают идемпотентную запись. HTTP-коды не нужны для локальных скриптов.
- Варианты:
  - [x] Полагаться на `MERGE` и констрейнты; без HTTP-кодов в локальных скриптах
  - [ ] Возвращать 409 при дублях
- Предложение: без HTTP-кодов на этой итерации (локальные скрипты).
- Ответ: ок

12) Тестовые данные и очистка между прогонами:
- Варианты:
  - [ ] Добавлять `dataset_id` всем создаваемым узлам/связям и чистить `MATCH (n {dataset_id:$id}) DETACH DELETE n`
  - [x] Полностью сбрасывать БД (удалять volume/контейнер) — чище и нагляднее
- Предложение: для скорости разработки использовать сброс БД (volume/контейнер) на MVP.
- Ответ: ок

13) Можно ли ещё упростить план?
- Варианты упрощения:
  - [x] Исключить тропы (`Trail`) из MVP
  - [ ] Не учитывать стаж в роли на первом шаге
  - [x] Убрать фильтр по индустрии и оставить роль+домены+скиллы
- Предложение: исключаем `Trail`; стаж остаётся обязательным через `role_started_at`; индустрию убираем из фильтра.
- Ответ: ок
