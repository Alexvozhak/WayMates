# WayMates (MVP scripts)

## Быстрый старт

1. Поднять Neo4j (Docker) и выполнить init:
   - `npm run initdb`

2. Провалидировать тестовые JSON:
   - `npm run validate`

3. Загрузить фикстуры:
   - `npm run seed`

4. Поиск когорты:
   - `npm run search -- query-context.json`

## Переменные окружения

Скопируйте `env.sample` в `.env` и при необходимости измените значения:

- `NEO4J_URI` (default: `bolt://localhost:7687`)
- `NEO4J_USER` (default: `neo4j`)
- `NEO4J_PASSWORD` (default: `neo4jtest`)

## Структура

- `src/persist.ts` — запись контекста в Neo4j (узлы/связи)
- `src/search_cohort_simple.ts` — поиск когорты
- `src/schemas.ts` — TypeBox схемы для валидации и типов
- `database/init.cypher` — констрейнты/индексы


