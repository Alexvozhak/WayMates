# Наставления

Паттерны ошибок и правила проекта WayMates. Формат: ошибка → правило.

---

## 1. Перед изменением кода

### Grep аналогичные места
Делаю по-своему вместо консистентности → grep аналоги (search-graph = эталон для cold-start). Если паттерн есть — следовать ему.

### Проверить схему перед правкой промпта
Добавил поле в промпт которого нет в схеме → читать целевую Zod schema перед правкой extraction/planning промпта.

### Проверить buildHints
"map to KNOWN X" без словаря → grep `buildHints()`, добавить тип в массив если отсутствует.

### Сравнить типы перед унификацией
Предложил generic не сравнив схемы → grep схемы, сравнить поле за полем перед унификацией.

### Проверить регресс
Исправил shared код, сломал другое → запустить ВСЕ связанные тесты после правки classifier/prompts/router.

### Проверить eslint.config.mjs
Использовал `as` cast → проверить eslint.config.mjs перед `as`, `any`, `!`. Запрещено — искать type-safe альтернативу.

### Проверить все intents фазы
Изменил один route, сломал другой → при изменении routing проверить ВСЕ intents фазы. Таблица: intent → node → что делает.

### Проверить data flow до UI
Два источника message конфликтуют → проследить ВЕСЬ data flow до UI перед изменением. Один источник истины для каждого поля.

### Оценить бизнес-ценность
Рефакторинг "для консистентности" → (1) Какая бизнес-ценность? (2) Что сломается если НЕ делать? (3) Код работает? → возможно не нужно.

---

## 2. При отладке

### Debug от конца к началу
Искал проблему в classification, баг был в response-builder → при проблеме с output: (1) что NLP получил, (2) что response-builder вернул, (3) classification.

### Pipeline tracing
Долго гадал где проблема → logging на КАЖДОМ этапе: Core → Facade → response-builder → NLP. Проверять prompt/data contract.

### Убирать части query
Debug всего Cypher сразу → убирать части по одной, пока результат не изменится — найдёшь проблемную.

### Какой модуль пересобирать
Изменил код, не вижу эффекта → `src/cypher/`, `src/core/` → `core:rebuild`. `src/facade/` → `facade:rebuild`. `src/telegram-bot/` → `bot:docker:restart`.

---

## 3. LLM Prompts

### Семантика вместо конкретики
Примеры/цитаты/шаблоны в промпте → только семантика: ЧТО и ЗАЧЕМ, не КАК выглядит фраза. `.describe()` тоже — генерировать динамически.

### Словари = source of truth
LLM выдумывает значения → инжектировать position, domain, skill, industry в промпт. LLM сопоставляет семантически.

### Multilingual input
LLM ожидает английский → "Response may be in any language" для русского/смешанного input.

### Phase context для classification
"хочу senior" = разный intent в разных фазах → передавать phase context в classifier.

### Инструкции фаз взаимоисключающие
NLP для одной фазы применяет инструкцию другой → инструкции в PHASE_DESCRIPTIONS должны быть взаимоисключающими.

### ONLY X, do NOT Y
"FIRST X, then Y" — LLM делает оба → "Show ONLY X. Do NOT show Y." Явно указывать что НЕ делать.

### Structured schema > .describe()
LLM игнорирует `.describe()` → структурированная schema с отдельными полями, форматирование в TypeScript. Schema = contract, describe = hint.

### NLP message зависит от data
Инструкция без данных → проверить что данные есть в response-builder перед добавлением инструкции в prompt.

### Prompt показывает только valid intents
LLM выбирает invalid intent → prompt должен показывать ТОЛЬКО valid intents. `getValidIntentsForPhase(phase, flags)`.

---

## 4. Types/Zod

### null единообразно
Смешиваю null/undefined → `null` единообразно. OpenAI требует nullable (не optional), Neo4j возвращает null, JSON не имеет undefined.

### Zod .parse() вместо as
`as Type` чтобы заткнуть TypeScript → Zod `.parse()` или typeguard. Каст = сигнал что типы неправильные.

### z.enum вместо z.string
`z.array(z.string())` для ограниченных значений → `z.enum([...])` — LLM видит допустимые значения в JSON schema.

### keyof вместо строк
`type Field = "a" | "b"` дублирует ключи → `keyof Pick<BusinessType, ...>`. TypeScript потребует описание при добавлении поля.

### satisfies для type-safety
Массив строк без связи с типом → `[...] as const satisfies readonly Field[]`.

### Zod .options для значений
Дублирую ключи и значения → использовать `schema.options` для извлечения значений enum.

### hasValue() для пустоты
`??=` не работает с `[]` → `hasValue()` проверяет null, undefined, [], "". LLM может вернуть `[]` вместо null.

### Zod error → human-readable
`.describe()` не попадает в error → создавать маппинг field → message для human-readable errors.

---

## 5. LangGraph

### userResponse очищать
userResponse не очищается → после использования `userResponse: ""` в return.

### 4 места при добавлении intent
Intent добавлен не везде → (1) state.ts — arrays, (2) parse-intent.ts — schema, (3) prompts.ts — descriptions, (4) search-router.ts — route map.

### unknown → explicit route
Полагаюсь на fallback для unknown → explicit route `unknown` → `clarify_intent`.

### ask intent в каждой фазе
"что ты умеешь?" → cancel → `ask` intent должен быть в КАЖДОЙ фазе.

### interrupt() прерывает выполнение
Код после interrupt() не выполняется → данные готовить ДО interrupt или в предыдущей ноде.

### State params propagate вручную
Params теряются после node → nodes которые НЕ меняют params должны возвращать их.

### undefined → null для JSON
`JSON.stringify({a: undefined})` → `{}` → явно `value ?? null`.

### Placeholder strings → builder functions
`.replace("{field}", value)` → builder function с явными аргументами. IDE подсказывает, TypeScript проверяет.

### proceed ≠ explore
"глянь похожих" → proceed → wrong → `proceed` = pure confirmation, `explore` = request to see similar.

### Advisor не тупик
Advisor без выхода в main flow → generic `action` intent → роутит в parse_search_intent.

### INTERRUPT ноды не промежуточные
Роучу в confirm_* чтобы "вернуться" → interrupt() ВСЕГДА останавливает. Для возврата без interrupt — роутить в PARSE ноду.

---

## 6. Cypher

### WITH сбрасывает переменные
Переменная undefined после WITH → `WITH *` сохраняет все, `WITH x, y` — только x и y.

### Null safety для optional
`WHERE all(d IN c.domains ...)` без проверки → `CASE WHEN x IS NULL THEN true ELSE ... END` для optional properties.

### Map projection вместо TS mapping
Маплю поля в TypeScript → `RETURN { field1, computed: expr } AS result` — один cast в TypeScript.

### collect()[0] вместо LIMIT
`ORDER BY x LIMIT 1` после aggregation → для per-group limit: `collect(...)[0]` внутри aggregation.

---

## 7. Тесты

### Не подгонять assertion
Тест падает → меняю assertion → исследуй ПОЧЕМУ. Тест = бизнес-требование, часто это баг в коде.

### Инварианты, не конкретный output
Проверяю конкретный LLM output для edge case → проверять инварианты системы (не упала, фаза валидна).

### Negative assertions
Только "U5 найден" → проверять что правильное найдено + неправильное исключено.

### Актуальные даты
Фикстуры с датами 2022 → даты должны быть в пределах production thresholds (recency = 12 мес).

### Логика тестовых данных
User достигает цели раньше Pathfinder → проверять что данные имеют смысл в бизнес-контексте.

### Не подыгрывать LLM
Скриптовые сообщения вместо реакции → читать ответ → реагировать по смыслу. Токсичный пользователь не знает "правильных" команд.

---

## 8. Процесс работы

### Pre-Action Declaration
Сразу Edit без объяснения → 90%+ уверенность. **Проблема** → **Как сейчас** → **Как будет** → **Уверенность %**. Ждать "ок" перед Edit.

### Не угадывать
Додумываю бизнес-решения / принимаю "баг" без проверки / делаю архитектурные утверждения без верификации → бизнес-решения спрашивать явно, техническое проверять по коду/докам, давать % уверенности.

### Искать в документации
Спрашиваю вместо поиска → сначала GLOSSARY, BUSINESS-LOGIC, schemas. Спрашивать только если не нашёл.

### Файл не найден — искать
"Файл не найден" без поиска → `Glob` по имени (`**/*name*.md`).

### Визуальная верификация
Считаю баг исправленным → визуальная верификация пользователем обязательна.

### Добавлять в матрицу
Верифицировал через mcp-chat.ts → добавить строку в tests_report.md.

### Завершил — ждать апрув
Сразу следующая задача → Pre-Action Declaration → ждать явный "ок".

### UX первичен
Техническое решение без UX → (1) "Как это ощущается пользователем?", (2) "Что пользователь уже видел?" — не дублировать, (3) тестировать естественной речью.

### Не делегировать без согласия
Task agent без разрешения → "Давай дальше сам" = работаю сам.

### Думать о workflow
Реализую без понимания использования → "А workflow какой будет?" — думать ДО реализации.

---

## 9. Код

### YAGNI
Fallbacks/wrappers "на всякий случай" → добавлять сложность только при доказанной необходимости.

### DRY сразу
Дублирование "на потом" → HOF/abstraction сразу. 1 час на HOF = экономия на поддержке.

### Имя = семантика
Функция изменилась, имя старое → семантика меняется → имя меняется.

### Бизнес-названия
`isArray`, `contextMultiValue` → названия должны отражать бизнес-семантику. "Как объяснил бы продакт?"

### lint:fix для рутины
Ручной cleanup импортов → `lint:fix` удаляет unused, форматирует.

### Filesystem MCP для batch операций
SED для массовых изменений / много Read подряд → `mcp__filesystem__edit_file` для batch edit, `mcp__filesystem__read_multiple_files` для массового чтения. Потом `lint:fix` исправит импорты.

### Фиксить в правильном слое
Workaround в Facade для бага в Core → баг в Core → фикс в Core.

### Тернарник для 2 значений
Map для 2 значений → `key === "a" ? 1 : 2`. Map оправдан для 3+.

### Inline грязь
`...(condition && { field })` → явные переменные или if/else.

### Env defaults = silent bugs
`.default()` для env → explicit required = fail fast. Лучше упасть сразу.

---

## 10. Коммуникация

### Честный анализ
Подтверждаю ожидания → честный анализ > угодничество. Плюсы/минусы, не "да, конечно!"

### Объяснять просто
Технические термины без объяснения → "Печатаем JS в файл" понятнее чем "esbuild bundle injection".

### Уточнять неоднозначности
Предположения вместо вопросов → лучше AskUserQuestion чем переделывать.

### Решение с альтернативами
Одно решение без обоснования → (1) контекст, (2) варианты с +/-, (3) рекомендация, (4) % уверенности.
