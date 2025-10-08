# Межконтекстные корзины (StoryBucket) — спецификация MVP

> Коротко: **межконтекстная корзина** — минимальный контейнер «между двумя контекстами A и B одного пользователя». В корзине **нет** агрегатов и «ритмов». Вся измеримая информация хранится **внутри историй (Story)**. Поиск строится **от контекста A**.

---

## 1) Термины и идея

- **ContextSnapshotRef (CSR)** — опорный срез контекста пользователя на момент времени. Имеет канонизированное описание (`signature_text`) и `embedding` для ANN-поиска. Полный JSON-снимок хранится во внешнем объектном хранилище; в графе — только лёгкая ссылка (Ref).
- **StoryBucket (межконтекстная корзина)** — **минимальный** контейнер, который связывает **CSR_A (FROM)** и **CSR_B (TO)** одного автора. Содержит **только служебные поля** и **список историй**.
- **Story (история/тропа)** — измеримые данные пути: период, график, суммарные часы/стоимость, ресурсы (ссылки на курсы/книги/менторинг/рабочие материалы), «пачка навыков», оценка 1–5 и признак «советует/нет». История **лежит внутри одной корзины**.
- **Skill / CourseResource** — справочники навыков и ресурсов (канонизированные ссылки).

**Поисковая логика:** Матчим текущий контекст пользователя на **CSR_A** других людей → берём **все корзины (A→B)**, исходящие из этих CSR_A → раскрываем **истории** и ранжируем под ограничения пользователя. CSR_B используется как справочная «точка назначения» (не участвует в первичной фильтрации).

---

## 2) Узлы и обязательные поля (минимум)

### User
- `user_id` — уникальный идентификатор
- `created_at`
- `privacy_default` — режим приватности по умолчанию

### ContextSnapshotRef (CSR)
- `snapshot_id` — уникальный
- `user_id`
- `ts` — ISO-время снимка
- `signature_text` — канонизированная «суть» контекста
- `embedding` — вектор (для HNSW / ANN)
- `hash`, `size` — метаданные файла слепка
- `approx_share` — доля примерных полей в слепке (0..1)

### StoryBucket (межконтекстная корзина)
- `bucket_id` — уникальный
- `owner_user_id`
- `from_snapshot_id` — **CSR_A (обязательно)**
- `to_snapshot_id` — **CSR_B (обязательно)**
- `created_at`
- `status` — `draft | confirmed | verified`
- `privacy` — `private | cohort | public_anon`

> **Важно:** в корзине **нет** агрегатных метрик (медианы, ритм и т.д.). Это чистая «скоба» между A и B плюс контейнер историй.

### Story (история/тропа)
- `story_id` — уникальный, `owner_user_id`, `created_at`
- **Period:** `start_date`, `end_date`, `granularity (day|month|year)`, `approx`
- **Schedule:** `freq (weekly|daily|self_paced)`, `sessions_per_week`, `typical_session_minutes`, `schedule_approx`
- **Totals:** `hours_total`, `cost_total {amount, currency, cost_eur_at_ts}`
- **Basket:** 
  - упрощённо: `skills[]` (список id навыков), 
  - детально: `shares[{ skill_id, share_hours?, share_cost? }]` с инвариантами `Σshare_hours ≤ 1.0`, `Σshare_cost ≤ 1.0`
- **Resources:** `resources[{ resource_id, hours_share?, cost_share? }]`
- **Feedback:** `rating_1_5`, `recommend (bool)`, `evidence[]`
- `status` — `draft | confirmed | verified`
- `privacy` — `private | cohort | public_anon`
- `notes?`, `description_text?` — опционально

### CourseResource
- `resource_id`, `provider`, `platform`
- `url_canonical` — **уникальный** (без UTM/рефкодов)
- `modality` — `course | book | mentoring | work | other`
- `title?`, `locale?`

### Skill
- `skill_id`, `name`, `aliases[]?`

---

## 3) Связи в Neo4j (Labels → Relations)

**Labels:** `User`, `ContextSnapshotRef` (CSR), `StoryBucket`, `Story`, `Skill`, `CourseResource`.

**Relations:**
- `(:User)-[:HAS_SNAPSHOT]->(:CSR)`
- `(:CSR)-[:HAS_OUTGOING_BUCKET]->(:StoryBucket)`  — корзина «исходит» из CSR_A
- `(:StoryBucket)-[:FROM]->(:CSR)`  — указывает на CSR_A
- `(:StoryBucket)-[:TO]->(:CSR)`    — указывает на CSR_B
- `(:StoryBucket)-[:CONTAINS]->(:Story)`
- `(:Story)-[:COVERS_SKILL {share_hours, share_cost}]->(:Skill)`
- `(:Story)-[:USED_RESOURCE {hours_share?, cost_share?}]->(:CourseResource)`

**Констрейнты/индексы:**
- UNIQUE: `User.user_id`, `CSR.snapshot_id`, `StoryBucket.bucket_id`, `Story.story_id`, `CourseResource.url_canonical`
- INDEX: 
  - векторный индекс HNSW на `:CSR(embedding)` для ANN-поиска,
  - `:Story(start_date, end_date, status)`,
  - `:StoryBucket(from_snapshot_id, to_snapshot_id, status)`

---

## 4) Поиск и подбор (MVP)

1. **Матч контекста A.**  
   Текущий контекст пользователя → `signature_text + embedding` → kNN по `:CSR(embedding)` → список подходящих **CSR_A** разных авторов.

2. **Корзины из A.**  
   Для каждого **CSR_A**: `CSR_A-[:HAS_OUTGOING_BUCKET]->(:StoryBucket)` → собираем **все корзины A→B**.

3. **Истории внутри корзин.**  
   `StoryBucket-[:CONTAINS]->(:Story)` → извлекаем **истории** и применяем фильтры/ранжирование по: срокам (`Period`/`hours_total`), графику (`freq/sessions_per_week/typical_session_minutes`), стоимости (`cost_total`), источникам (`CourseResource`), оценке (`rating_1_5`, `recommend`), статусу (`confirmed|verified`).  
   CSR_B используется **справочно** — «куда эта история приводила».

---

## 5) n8n — минимальные процессы

**A. Onboarding / Snapshot**  
Текст контекста → экстракция → сохраняем **CSR** (JSON-слепок в объектном сторе; Ref — в Neo4j) → векторизация `embedding`.

**B. Create Story + Bucket**  
Q&A по истории → нормализация (Period, Schedule, Totals, Resources, Skills) → находим/создаём **CSR_A** и **CSR_B** по датам →  
`MERGE StoryBucket(from=CSR_A, to=CSR_B)` → `CREATE Story` → `CONNECT StoryBucket-[:CONTAINS]->Story`.

**C. Recommendation**  
Вход: текущий контекст + ограничения → kNN по CSR → собрать корзины A→B → раскрыть истории → фильтры/ранжирование → ответ.

**D. Resource Canon**  
Нормализация ссылок → `MERGE CourseResource(url_canonical)` → связь `Story-[:USED_RESOURCE]->CourseResource`.

---

## 6) Валидации (инварианты для будущей JSON-схемы)

- **Story (обязательные условия):**  
  - `start_date ≤ end_date`  
  - `hours_total ≥ 1`  
  - `rating_1_5 ∈ [1..5]`  
  - `cost_total.amount ≥ 0`  
  - если `freq=weekly` → `1 ≤ sessions_per_week ≤ 7`, `30 ≤ typical_session_minutes ≤ 240`
  - `Σshare_hours ≤ 1.0`, `Σshare_cost ≤ 1.0`
  - `status ∈ {confirmed, verified}` и `privacy ≠ private` → участвует в рекомендациях

- **StoryBucket:**  
  - обязаны быть **оба указателя**: `from_snapshot_id` и `to_snapshot_id`

- **CourseResource:**  
  - `url_canonical` — уникальный и канонизированный (без UTM/рефкодов)

---

## 7) Почему это соответствует задумке

- Корзина — **чистая связка A↔B**, без статистики и ритмов.  
- Поиск идёт **только от A** (совпавший контекст), затем раскрываются **истории**.  
- Все численные/измеримые данные — **на уровне Story**, не на уровне корзины.  
- B — **справочно**: позволяет видеть, куда приводили истории, но не участвует в первичном фильтре.

---

### Что описать в JSON Schema ($defs)
- Объекты: `ContextSnapshotRef`, `StoryBucket`, `Story`, `CourseResource`, `Skill`  
- Общие типы: `Period`, `Schedule`, `Money`, `URL`  
- Перечисления: `status`, `privacy`, `modality`, `granularity`, `freq`

Эта спецификация готова для переноса в схемы AJV/TypeBox и для первичной миграции Neo4j (MERGE-констрейнты + индексы).
