# Cypher Audit Recommendations

## SIMILAR_CONTEXTS (Finders)
- 🚨 ПРОБЛЕМА: Запрос не использует `searchConstraints.max_timing_diff_months` и `max_experience_diff_months`, поэтому выдаёт кандидатов с любым стажем/давностью. Это снижает релевантность и ломает требование "< 5 секунд" при большом графе.
- ⚡ ОПТИМИЗАЦИЯ: После блока `MATCH` добавить фильтры по стажу/таймингу и лимит `LIMIT coalesce($searchConstraints.max_users, 100)` в этом же блоке вместо полагаться на downstream. По документации Neo4j [PROFILE](https://neo4j.com/docs/cypher-manual/25/planning-and-tuning) стоит использовать для проверки плана.
- ⚡ ОПТИМИЗАЦИЯ: Рекомендуется индекс `CREATE INDEX FOR (c:Context) ON (c.company_size, c.industry, c.work_type)` и `CREATE INDEX FOR (s:Skill) ON (s.name)`; текущий фильтр `all(... Skill {name: s})` без индекса даёт NodeById → NodeIndexSeekFallback.

## TARGET_ACHIEVERS + SEARCH_RESULTS
- 🚨 ПРОБЛЕМА: `OPTIONAL MATCH (dbTargetContext)-[:USES_SKILL]->(skill)` c `collect({ name: skill.name, category: skill.category })` возвращает `[ {name: null, category: null} ]` когда навыков нет. Zod схема падает. Нужно фильтровать `WHERE skill IS NOT NULL` или использовать list comprehension.
- 🚨 ПРОБЛЕМА: `searchConstraints.min_experience_months` и `max_experience_months` нигде не применяются → бизнес-требование игнорируется.
- ⚡ ОПТИМИЗАЦИЯ: Добавить индекс `CREATE INDEX FOR (c:Context) ON (c.created_at)` и `CREATE INDEX FOR (p:Position) ON (p.name)`; запрос каждый раз делает полные сканы.
- ⚡ ОПТИМИЗАЦИЯ: В `SEARCH_RESULTS` стоит использовать `DISTINCT targetUser` перед `RETURN`, иначе повторяющиеся связи `USES_SKILL` увеличивают результат.

## TARGET_TRANSITIONS + COMPATIBILITY_SCORE
- 🚨 ПРОБЛЕМА: `COMPATIBILITY_SCORE` возвращает `trailPath: []`, `positionTimingDiff* = 0`, `currentExperienceDiffMonths = 0`. Это placeholder и ломает ожидания продукта (нет реального пути). Тест `current_to_target` фиксирует заглушку.
- ⚠ РИСК: Нет ограничений на количество target контекстов; `LIMIT` только в конце (`LIMIT 100`). При больших пользователях → рост времени ответов. Перенести ограничение ближе к `MATCH` и рассмотреть `USING INDEX` (см. [пример](https://neo4j.com/docs/cypher-manual/25/indexes/search-performance-indexes)).

## CAREER_PROGRESSION (Current Only)
- 🚨 ПРОБЛЕМА: При отсутствии следующего контекста возвращается `transitionContextId: ''`, что не соответствует `ContextIdSchema` (RegExp `^ctx_`). Наши unit тесты покрыли happy path, но в реальных данных это бросит Zod ошибку. Нужно либо исключать такие записи, либо возвращать `null` и обновить схему на optional.
- ⚠ РИСК: Поля `companyTypeTransition`, `industryTransition`, `techStackTransition`, `workFormatTransition` всегда пустые строки. Лучше возвращать `null` и заполнять только при срабатывании триггера.
- ⚡ ОПТИМИЗАЦИЯ: добавить индекс `CREATE INDEX FOR (c:Context) ON (c.created_at)` для фильтра по `duration.inMonths`.

## Общие рекомендации
1. Использовать `PROFILE`/`EXPLAIN` для всех SearchQueries и зафиксировать планы в репозитории (`docs/`), чтобы отслеживать регрессии (см. [PROFILE пример](https://neo4j.com/docs/cypher-manual/25/planning-and-tuning)).
2. Добавить end-to-end тест, который проверяет отсутствие `null`/пустых строк в массивах (`skills`, `domains`). Наши интеграционные тесты ссылаются на это поведение.
3. Для production включить `neo4j.conf` настройку `dbms.transaction.timeout=5s`, чтобы гарантировать SLA < 5 секунд.
