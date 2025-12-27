# Session: Cold-Start UX Fix

**Дата:** 2025-12-27
**Фокус:** Проблема #1, #2 — статичное сообщение в story_gathering

---

## Что сделано

### Фаза 1: Диагностика

1. **Протестировали cold-start flow** через `poc/mcp-chat.ts`
2. **Выявили проблему**: При повторном входе в `story_gathering` бот показывает тот же статичный текст без acknowledge
3. **Нашли root cause**: Два источника message — interrupt и response-builders, при этом interrupt.message игнорируется

### Фаза 2: Анализ архитектуры

1. **Сравнили с search-graph**: там response builders возвращают ДАННЫЕ, не message
2. **Выбрали решение**: Добавить `messageCount` в schema, NLP сам формирует текст на основе данных
3. **Убрали message из schema** для story_gathering — консистентно с search-graph

### Фаза 3: Реализация

**Изменённые файлы:**

| Файл | Изменение |
|------|-----------|
| `src/shared/schemas.ts` | `story_gathering`: убрали `message`, добавили `messageCount: z.number()` |
| `src/facade/langGraph/cold-start-v2/response-builders.ts` | Передаём `messageCount: state.messages.length`, убрали `buildGatherMessage` |
| `src/facade/langGraph/cold-start-v2/nodes/gather-story.ts` | Убрали `message` из interrupt, убрали `buildGatherMessage` |
| `src/facade/services/nlp-formatter/prompts.ts` | Логика: `messageCount <= 1` → спросить, `> 1` → acknowledge |

---

## Что делать дальше

1. **Протестировать полный flow:**
   ```bash
   set -a && source .env.test && set +a
   npx tsx poc/mcp-chat.ts --session cs-final --reset
   npx tsx poc/mcp-chat.ts --session cs-final "хочу рассказать карьеру"
   npx tsx poc/mcp-chat.ts --session cs-final "я бэкендер, 5 лет опыта"
   npx tsx poc/mcp-chat.ts --session cs-final "готово"
   ```

2. **Проверить что:**
   - Первое сообщение: спрашивает про карьеру (`messageCount: 1`)
   - Второе: acknowledge + приглашение продолжить (`messageCount: 2`)
   - "готово": переход к `awaiting_plan_confirmation`

3. **Если работает** — запустить lint + tsc

---

## Ключевые решения

| Вопрос | Решение | Почему |
|--------|---------|--------|
| Где формировать текст? | NLP formatter | Консистентно с search-graph, SRP |
| Как NLP узнает состояние? | `messageCount` в response | Минимальное изменение schema |
| Нужно ли приветствие? | Нет отдельного | Telegram bot здоровается при /start |
| "Say 'done'"? | Нет триггерных слов | "let you know when done" — мягче |

---

## Рефлексия

### Паттерн ошибки: Два источника истины

**Ситуация:** interrupt содержит message, response-builders тоже — конфликт.

**Первопричина:** Не изучил как работает data flow перед изменениями. Предположил что interrupt.message используется, но он игнорируется.

**Правило:** Перед изменением проследить ВЕСЬ data flow от источника до UI. Найти единственный источник истины.

### Паттерн ошибки: Детектирование состояния по косвенным признакам

**Ситуация:** Пытались определить "первое сообщение vs повторное" через `messages.length`, но первое сообщение — intent, не контент.

**Первопричина:** Не понял семантику данных. `messages` содержит ВСЁ включая intent, а нужен был только карьерный контент.

**Правило:** При использовании данных для логики — понимать их СЕМАНТИКУ, не только структуру.

---

## Артефакты

- Тестовая сессия: `--session cs-final`
- Инфра: уже поднята (`npm run test:telegram:setup`)
