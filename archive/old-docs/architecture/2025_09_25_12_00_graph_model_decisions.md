# WayMates — решения по графовой модели (WIP)

Обновлять по мере согласований. Когда вопрос закрыт — переносим его из «Открытые вопросы» в «Принятые решения».

## Принятые решения

- Узлы (бизнес‑сущности):
  - `User { user_id }`
  - `Context { context_id, period_start, period_end, role_started_at }`
  - `Role { name }`
  - `Grade { name }`
  - `Company { name }`
  - `Industry { name }`
  - `WorkDomain { name }`  (например: Backend, Frontend, Architecture, …)
  - `Skill { name }`
  - `SkillCategory { name }`  (languages | runtimes | frameworks | libraries | databases | cloud | devops_tools | testing_tools | skills_hard)

- Связи:
  - `(User)-[:HAS_CONTEXT { is_current: boolean }]->(Context)`
  - `(Context)-[:IN_ROLE { started_at }]->(Role)`
  - `(Context)-[:HAS_GRADE { awarded_at }]->(Grade)`
  - `(Context)-[:AT_COMPANY { joined_at }]->(Company)`
  - `(Company)-[:IN_INDUSTRY]->(Industry)`
  - `(Context)-[:IN_WORK_DOMAIN]->(WorkDomain)`  (многие)
  - `(Context)-[:USES_SKILL]->(Skill)`  (многие)
  - `(Skill)-[:IN_CATEGORY]->(SkillCategory)`  (ровно одна основная категория)
  - Вторичных тегов у `Skill` не вводим. Вопросы «где применяется скилл» решаем через связи контекстов: `(:Skill)<-[:USES_SKILL]-(:Context)-[:IN_WORK_DOMAIN]->(:WorkDomain)` и `(:Context)-[:AT_COMPANY]->(:Company)-[:IN_INDUSTRY]->(:Industry)`.
  - Релевантность `Skill ↔ WorkDomain`: отдельную связь `(:Skill)-[:RELEVANT_TO]->(:WorkDomain)` сейчас НЕ вводим; выводим релевантность через контексты. Вернёмся только при реальной потребности.

- Уникальные констрейнты:
  - `User.user_id`, `Context.context_id`
  - `Role.name`, `Grade.name`, `WorkDomain.name`, `Industry.name`, `SkillCategory.name`
  - `Company.name`
  - `Skill.name`  (нормализованное каноническое имя; синонимы приводятся до каноники вне БД)

- Текущие vs прошлые контексты и скиллы:
  - «Текущий» определяется через `HAS_CONTEXT.is_current = true`.
  - Скиллы всегда привязаны к конкретному `Context` через `USES_SKILL` → прошлые/текущие различаются выборкой контекста.
  - Нумерация контекстов не нужна: порядок определяется по `period_start/period_end`.

- Даты — на рёбрах контекста (`IN_ROLE.started_at`, `HAS_GRADE.awarded_at`, `AT_COMPANY.joined_at`).

- Совместимость на время миграции:
  - Поля‑массивы в `Context` временно сохраняем для обратной совместимости, но «источником истины» считаем связи.
  - Поиск и аналитика переписываются на связи; массивы позже удалим.

## Нормализация и входные данные для матчинга

- MVP: считаем, что входные JSON уже нормализованы (канонические `Skill.name`, корректные `WorkDomain`). Приложение нормализацию НЕ выполняет, делает только проверку типов/форматов. 

## Простой матчинговый сигнал по рабочим доменам

- `domainMatch` — бинарный признак релевантности области труда:
  - `1`, если есть хотя бы один общий `WorkDomain` между нашим контекстом и контекстом кандидата;
  - `0`, если пересечения нет.
- При необходимости можно расширить до взвешенного варианта через свойства на ребре `IN_WORK_DOMAIN {primary, weight}`.

## Мягкие временные факторы (без жёсткого отсева)

- `expDelta` — |опыт кандидата в роли − наш опыт| (в годах), опыт считаем из `role_started_at`.
  - Пример: у нас 1 год, у кандидата 8 лет → `expDelta = 7` (кандидат релевантен, но чуть ниже в списке).
- `temporalPenalty` — давность контекста кандидата относительно опорной даты (обычно `now`): разница в годах до середины его периода.
  - Пример: совпадение идеальное, но контекст 5 лет назад → небольшой штраф, но контекст остаётся в выдаче.

## Базовая формула скоринга (дефолт)

- `coverage = matchedSkills / |skills(мы)|`
- `score = 0.7*coverage + 0.2*domainMatch − 0.08*expDelta − 0.02*temporalPenalty`
- Порог отбора: `coverage ≥ 0.6` с адаптацией при дефиците результатов: `0.6 → 0.4 → 0.0`.
- Опция `currentOnly` — по умолчанию выключена; включение ограничивает поиск только текущими контекстами владельцев (use‑case: нетворкинг/peer‑support).

## Жизненный цикл навыков (MVP)

- Не рассчитываем per‑skill `first_used` / `last_used` / `current_used`.
- «Свежесть» учитываем только через даты самих `Context` (temporalPenalty в ранжировании).

## Обоснования ключевых решений

- Skill как один тип узла + `SkillCategory` узлом (вариант A):
  - Проще запросы (один матч по `Skill`), легче считать coverage, удобнее индексация.
  - Если потребуется вторичная классификация: добавим `(:Skill)-[:TAGGED_AS]->(:SkillCategory)` без замены основной `IN_CATEGORY`.

- Company уникальна по `name`; `Industry` — узел:
  - Для MVP не используем web‑домен в ключе; это вспомогательная информация, не влияющая на аналитику.
  - Индустрия используется для срезов и агрегатов — оправдан отдельный узел.

## Открытые вопросы

На текущий момент нет.

## Типовые запросы (ориентиры)

- Скиллы текущего контекста пользователя:
```cypher
MATCH (u:User {user_id:$id})-[:HAS_CONTEXT {is_current:true}]->(c)-[:USES_SKILL]->(s)
RETURN s
```

- Кандидаты по роли и рабочим доменам с coverage по скиллам:
```cypher
MATCH (c:Context)-[:IN_ROLE]->(:Role {name:$role})
WHERE EXISTS { MATCH (c)-[:IN_WORK_DOMAIN]->(d:WorkDomain) WHERE d.name IN $workDomains }
MATCH (c)-[:USES_SKILL]->(s:Skill)
WITH c, count(CASE WHEN s.name IN $userSkills THEN 1 END) AS matched, size($userSkills) AS total
WITH c, CASE WHEN total=0 THEN 0.0 ELSE toFloat(matched)/total END AS coverage
WHERE coverage >= $minCoverage
RETURN c, coverage
ORDER BY coverage DESC
```

- «Где применяется конкретный скилл» через контексты:
```cypher
// распределение по WorkDomain
MATCH (:Skill {name:$skill})<-[:USES_SKILL]-(c:Context)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
RETURN wd.name AS work_domain, count(*) AS cnt
ORDER BY cnt DESC

// распределение по Industry
MATCH (:Skill {name:$skill})<-[:USES_SKILL]-(c:Context)-[:AT_COMPANY]->(:Company)-[:IN_INDUSTRY]->(i:Industry)
RETURN i.name AS industry, count(*) AS cnt
ORDER BY cnt DESC
```

## Следующие шаги

1) Добавить констрейнты из раздела «Принятые решения».
2) Обновить `persist.ts`: при upsert создавать/связывать справочники (массивы в `Context` пока оставляем).
3) Переписать `search_cohort.ts` на связи `IN_ROLE/IN_DOMAIN/USES_SKILL`.
4) После верификации — удалить массивы из `Context`.


