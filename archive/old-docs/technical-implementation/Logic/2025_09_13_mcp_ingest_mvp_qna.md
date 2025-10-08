## MCP Ingest (MVP) — вопросы, решения, примеры

_Дата: 2025-09-13_

### Глоссарий (очень коротко)
- **Envelope/«конверт»**: вспомогательная обёртка вокруг полезной нагрузки (истории), куда кладут служебные поля про источник. В MVP заменили на минимальный блок `source`.
- **Provenance (происхождение)**: откуда пришли данные (канал, система, ссылка, время). Нужно для прозрачности, аудита и фильтров.
- **Трассировка**: возможность по `source` быстро найти первоисточник/время загрузки.
- **Дедупликация (дедуп)**: предотвращение дублей при повторных загрузках (сравниваем `source.url|external_id`/хеш текста/подписи).
- **license/meta**: юридическая лицензия и произвольные метаданные источника. В MVP НЕ используем — избыточно.

### 1) Где живёт нормализация? Нужен ли /ingest/normalize?
- **Решение (MVP):** отдельного эндпоинта `/ingest/normalize` не делаем. Нормализация выполняется автоматически внутри `/ingest/persist` после успешной валидации.
- **Порядок:** n8n → `/ingest/validate?mode=strict|weak` → (ok) → `/ingest/persist` (нормализация + запись в Neo4j).
- **Что включает нормализация:**
  - Канонизация полей в EN (роль/домен/стек/локация) для `signature_text`.
  - Валюта → USD (с сохранением оригинальной валюты при наличии).
  - Даты → ISO, расстановка `granularity` и `approx=true` при нестрогом извлечении.
  - Без «догадок»: если факт не извлекается — поле опускаем.

Пример: история на русском с ценой в рублях → `signature_text` на EN, `cost_total.amount` в USD, `currency_original: 'RUB'` сохраняется в метаданных истории.

### 2) Нужен ли «единый конверт» (envelope) с полями license/meta?
- **Решение (MVP):** используем только минимальный `source`-блок для provenance. Поля `license`, обширные `meta` — не нужны на старте.
- **Минимум provenance:**
  - `source.channel`: `api|scrape|dump|telegram`
  - `source.system`: `pushshift|devto|habr|stackexchange|telegram`
  - `source.url` или `source.external_id` (хотя бы одно)
  - `source.fetched_at` (ISO-datetime)
  - `raw_text` и `lang` (если есть)

Этого достаточно для трассировки и дедупликации.

### 3) Валидация: режимы weak|strict
- Один эндпоинт: `/ingest/validate?mode=weak|strict`.
- Weak (для внешних источников):
  - Требуем: `source.system`, `source.channel`, одно из `source.url|source.external_id`, `source.fetched_at`.
  - Остальное опционально; `raw_text` и `lang` сохраняем при наличии.
- Strict (для Telegram/ручного ввода):
  - Требуем: `story.period.start_date`, `story.period.end_date`, `story.hours_total`, `story.rating_1_5`, `story.from_snapshot_id`, `story.to_snapshot_id`.
- Политика выбора (n8n): внешние → `mode=weak`; Telegram → `mode=strict`.

### 4) Расписание (schedule) — обязательно?
- **Решение (MVP):** `schedule` опционален. Пользователь мог выучить за один присест — тогда достаточно `period` и `hours_total`.

Примеры:
- «Однодневный интенсив»: `period.start_date = period.end_date`, `hours_total = 8`, `schedule` опущен.
- «Долгий курс»: добавляем `schedule: { freq: 'weekly', sessions_per_week: 2, typical_session_minutes: 90 }` при наличии информации.

### 5) Endpoints MCP (MVP)
- `/ingest/validate?mode=weak|strict` — AJV + пост‑проверка required по выбранному режиму.
- `/ingest/persist` — нормализация (EN/USD/ISO) + идемпотентная запись в Neo4j + дедуп.
- `/ingest/clarify` — список недостающих полей/вопросов (используем для Telegram).

Скрапинг/коннекторы — вне MCP (n8n или внешние сервисы). MCP — единый шлюз валидации/нормализации/записи.

### 6) AJV: где реализовывать?
- **Варианты:**
  - A) MCP‑сервис на Node.js/TS (Fastify/Express) с AJV v8. Рекомендуется: переиспользуемо для всех источников.
  - B) Узел Code в n8n с AJV — возможно, но сложнее поддерживать профили/версии схем.
  - C) TypeBox (+AJV) в MCP: типобезопасные схемы и одна точка правды.
- **Рекомендация:** вариант A/C — AJV внутри MCP.

Пояснение по стеку:
- AJV — валидатор JSON‑схем, не HTTP‑сервер. Чтобы n8n вызывал валидацию, нужен HTTP‑endpoint. Самый простой путь — небольшой HTTP‑сервис:
  - Express — минималистично, много middleware.
  - Fastify — быстрее, удобнее типизация, готовые плагины для схем.
  - «Без фреймворка» (node:http) — лишняя рутина.
- TypeBox/Zod — для описания типов. С TypeBox легко генерировать JSON Schema для AJV.
- Вывод: маленький Fastify‑сервис + TypeBox + AJV = компактно, типобезопасно, удобно версионировать.

Мини‑рецепт (что поставить):
- Fastify (`fastify`), AJV 8 (встроен в Fastify), TypeBox (`@sinclair/typebox`), и, при желании, `@fastify/swagger` для авто‑документации.

Готовые аналоги/паттерны:
- Fastify + AJV — официальный путь Fastify: схемы на JSON Schema валидируются из коробки.
- TypeBox + AJV — широко используемая связка для типобезопасных схем.
- Если нужен клиент внутри n8n/Node — используйте `axios` как HTTP‑клиент.

### 6.1) validate: режимы (MVP)
- Вызываем `/ingest/validate?mode=weak|strict`.
- Если параметр не передан, n8n должен явным образом выбирать режим.
- Валидация всегда: (1) AJV по базовой схеме → (2) пост‑проверка required‑полей по выбранному режиму.


### 7) CSR для внешних историй
- Если из текста извлекаются контексты — создаём `CSR_A/CSR_B` с `approx=true` и формируем связи `FROM/TO`.
- Если данных недостаточно — сохраняем историю со `status='draft'` без `CSR`, добавляем `raw_text` и provenance. Позже обогащаем (ручной ревью или новые данные).

### 8) Что значит participant_count / evidence_count / review_count?
- **participant_count** — сколько уникальных людей прошли эту же историю/маршрут (или очень близкую вариацию) и опубликовали её. Для внешних источников чаще `unknown`/пусто.
- **evidence_count** — сколько подтверждений приложено: сертификаты, репозитории, pull‑requests, ссылки на демо.
- **review_count** — сколько сторонних отзывов/комментариев о применимости/качестве пути.
- **Статус (MVP):** все три — строго опциональные, не требуются для записи. Нужны для будущего ранжирования/надёжности.

Идея «форков» истории (ветвления):
- Базовая история может вдохновлять пользователей, которые создают свою версию пути.
- В Neo4j:
  - `(:Story {story_id: base})-[:FORKED_INTO]->(:Story {story_id: fork1})`
  - `(:Story {story_id: base})-[:FORKED_INTO]->(:Story {story_id: fork2})`
- Тогда:
  - `participant_count` ≈ количество подтверждённых форков (`status in [confirmed, verified]`).
  - `evidence_count` — суммарное число `evidence` у форков или у самой истории.
  - `review_count` — число связанных узлов `(:Review)-[:ABOUT]->(:Story)` (если введём сущность Review).
 - На MVP можно просто хранить связи `FORKED_INTO` и считать агрегаты по ним.

Замечание про «рекомендует/не рекомендует»: 
- В строгом профиле достаточно требовать `rating_1_5`. Поле `recommend` делаем опциональным: если источник явно даёт «рекомендую/нет», сохраняем; если не даёт — не заполняем и можем выводить derived‑флаг в UI как `rating_1_5 >= 4` (без записи в БД).

### 9) Примеры Q&A для согласования (с вариантами ответов)
1) Где хранить реестр профилей источников (required‑наборы)?
   - A) В MCP (`SourceProfiles.json` + горячая перезагрузка)
   - B) В n8n (cred/env + передаём `profile` в `/validate`)
   - C) Гибрид: MCP по умолчанию, n8n может переопределить

2) Минимум provenance для внешних историй?
   - A) `source.system`, `source.channel`, `source.url|external_id`, `fetched_at`
   - B) + `raw_text`, `lang`
   - C) Ещё короче (только `system` + `url`), остальное позже

3) Валюта и язык:
   - A) Всегда EN‑канон для подписи + USD; оригинал сохраняем рядом
   - B) Сохраняем как есть, канон строим лениво при запросе

4) Поведение при неполных данных:
   - A) `mode=weak`, `status='draft'`, без CSR, но с полным provenance
   - B) Отбрасывать записи без периода вообще
   - C) Создавать «synthetic CSR»‑заглушки (не рекомендуется)

5) До-уточнения:
   - A) Только для Telegram/UI через `/ingest/clarify`
   - B) Пытаться доуточнить у внешнего API (если поддерживается)
   - C) Откладывать до модерации вручную

Комментарий: выбор режима делает интегратор в n8n. Для Telegram обычно `strict` (+clarify), для внешних источников — `weak` без доуточнений.

### 10) Короткие примеры полезных payload’ов
Пример внешней истории (weak) → persist:
```json
{
  "source": {
    "channel": "api",
    "system": "pushshift",
    "url": "https://reddit.com/r/cscareerquestions/...",
    "fetched_at": "2025-09-13T10:00:00Z"
  },
  "raw_text": "Got a promotion to Senior after 18 months...",
  "lang": "en",
  "story": {
    "status": "draft",
    "period": { "start_date": "2023-01-01", "end_date": "2024-06-30", "granularity": "month", "approx": true },
    "hours_total": 0,
    "recommend": true
  }
}
```

Пример пользовательской (strict) через Telegram → persist:
```json
{
  "source": { "channel": "telegram", "system": "telegram", "external_id": "tg-123", "fetched_at": "2025-09-13T11:00:00Z" },
  "story": {
    "status": "confirmed",
    "period": { "start_date": "2025-05-01", "end_date": "2025-06-15", "granularity": "day", "approx": false },
    "hours_total": 42,
    "rating_1_5": 4,
    "recommend": true,
    "from_snapshot_id": "snap-abc",
    "to_snapshot_id": "snap-def"
  },
  "context": {
    "snapshot_id": "snap-abc",
    "user_id": "u-42",
    "signature_text": "role: Frontend Developer (Middle) | domain: SaaS | stack: React, Node.js | location: Moscow, RU | tz: Europe/Moscow"
  }
}
```

### Справочник полей из примеров
- `granularity`: точность дат периода — `day|month|year`. Если знаем только месяц, ставим `month`.
- `approx`: признак, что значение приблизительное (мы не уверены на 100%).
- `recommend`: автор рекомендует этот путь/историю (true/false). В strict‑режиме поле не требуется — опираемся на `rating_1_5`. В UI можно показывать derived‑флаг `rating_1_5 >= 4` как «рекомендует» без записи в БД.

---

Если ответы выше ок, имплементируем: AJV в MCP, профили required по источникам, нормализацию внутри `/ingest/persist`, `schedule` опциональным, и минимальный provenance.


