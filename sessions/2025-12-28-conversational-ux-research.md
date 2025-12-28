# Исследование: Conversational UX для WayMates

**Дата:** 2025-12-28
**Контекст:** Рефакторинг search-graph для "живого простого разговора"
**Текущее состояние:** 20 фаз, 4+ interrupts до результата
**Цель:** Минимум прерываний, естественный диалог без меню/кнопок

---

## Резюме исследования

### Ключевой инсайт

**Phase-Driven** (текущее) vs **Intent-Driven** (рекомендуемое) — это не просто рефакторинг кода, это смена парадигмы UX:

| Подход | Ощущение пользователя |
|--------|----------------------|
| Phase-Driven | "Заполняю форму по шагам" |
| Intent-Driven | "Разговариваю с помощником" |

---

## Рекомендация: Intent-Driven + Confidence Routing

### Суть подхода

1. **Intent classification** вместо phase extraction
   - LLM классифицирует намерение: proceed, explore, clarify, filter, change
   - Не явная фаза, а inferred user goal

2. **Confidence-based autonomy**
   - `> 90%` → действуем автономно, показываем результат
   - `75-90%` → действуем + упоминаем допущение
   - `< 75%` → задаём КОРОТКИЙ уточняющий вопрос

3. **Streaming responses**
   - Показываем прогресс в реальном времени
   - Пользователь видит что система "думает"

4. **Context reuse**
   - Помним траекторию, не переспрашиваем
   - "Покажи pathfinders" — понимаем контекст из предыдущего

### Пример диалога

**Текущее (4+ interrupts):**
```
User: "Хочу перейти из backend в product в Европе"
Bot: Какая у вас роль? [INTERRUPT 1]
User: Backend разработчик
Bot: Какая целевая позиция? [INTERRUPT 2]
User: Product Manager
Bot: Какие страны? [INTERRUPT 3]
User: Германия, Нидерланды
Bot: Waymates или Pathfinders? [INTERRUPT 4]
User: Waymates
Bot: [результаты]
```

**Рекомендуемое (1-2 interrupts):**
```
User: "Хочу перейти из backend в product в Европе"

Bot: 🔍 Ищу переходы Backend → Product Manager в Европе...
     ✓ Найдено 5 waymates

     [результаты с траекториями]

     Хотите увидеть полные карьерные пути (pathfinders)?
```

---

## Альтернативы

### Альтернатива A: Hybrid (фазы + интенты)

- Оставить часть фаз для структуры
- Добавить intent classification внутри фаз
- Постепенная миграция

**Плюсы:** Меньше риска, инкрементальный рефакторинг
**Минусы:** Не решает проблему полностью, "полумера"

### Альтернатива B: Menu-Hub (ваши варианты A/B/C)

- main_menu как центральный hub
- Явные опции для пользователя
- Структурированная навигация

**Плюсы:** Предсказуемость, чёткие пути
**Минусы:** Всё ещё "меню", не "живой разговор"

---

## Сравнительная таблица

| Критерий | Текущее (20 фаз) | Рекомендуемое (Intent) | Альтернатива (Hybrid) |
|----------|------------------|------------------------|----------------------|
| **Архитектура** | Phase-driven state machine | Intent-driven routing | Фазы + intent внутри |
| **Фазы/Ноды** | 18 фаз + 24 ноды | 5 фаз + 8 нод | 10 фаз + 15 нод |
| **Interrupts до результата** | 4-6 | 1-2 | 2-3 |
| **LOC+** | — | +200 (intent classifier) | +100 |
| **LOC-** | — | -500 (удаление фаз) | -200 |
| **Итого LOC** | ~1200 | ~700 (-40%) | ~900 (-25%) |

---

### UX критерии

| Критерий | Текущее | Рекомендуемое | Альтернатива |
|----------|---------|---------------|--------------|
| **Ценность пользователю** | Средняя (результат есть, но долго) | Высокая (быстро к результату) | Выше среднего |
| **Честность** | Высокая (всё явно) | Средняя (автономные решения) | Высокая |
| **Удобство** | Низкое (много шагов) | Высокое (минимум шагов) | Среднее |
| **Простота** | Низкая (20 фаз) | Высокая (5 фаз) | Средняя |
| **Рациональность** | Низкая (over-engineering) | Высокая (Парето) | Средняя |

---

### Код (концептуально)

| Аспект | Текущее | Рекомендуемое |
|--------|---------|---------------|
| **State** | 18 фаз в enum, сложный routing | 5 фаз + intent + confidence |
| **Routing** | Условия hasGoal, canClarify везде | Confidence thresholds |
| **Interrupts** | interrupt() в каждой "show" ноде | interrupt() только для approval |
| **Streaming** | Нет | Да (progress в реальном времени) |

---

## Принципы из исследования (Best Practices 2025)

### 1. User Intent Over UI Tasks
- Проектируем для ЦЕЛЕЙ, не для КЛИКОВ
- "Понимает ли система что я хочу?" вместо "Сколько вопросов мне отвечать?"

### 2. Context Is Gold
- Помни, переиспользуй, проверяй — не повторяй
- Пользователь сказал "Европа" → не спрашиваем "какие страны?"

### 3. Transparency Builds Trust
- Показывай ЧТО, ПОЧЕМУ, КАК
- "Ищу PM в Европе..." → пользователь видит что происходит

### 4. Proactive Without Interruption
- Предлагай до того как спросят
- Но не блокируй (можно игнорировать)

### 5. Confidence Thresholds

| Confidence | Действие |
|------------|----------|
| > 90% | Действуем автономно |
| 75-90% | Действуем + упоминаем допущение |
| 50-75% | Короткий уточняющий вопрос |
| < 50% | Запрос контекста |

---

## Паттерны LangGraph

### Текущий анти-паттерн

```typescript
// interrupt() для КАЖДОЙ точки решения
const userResponse = interrupt({
  type: "asking_adhoc_context",
  message: "Какая у вас роль?",
});
// Пользователь заблокирован, ждёт ответа
```

### Рекомендуемый паттерн

```typescript
// interrupt() ТОЛЬКО когда нужно одобрение
if (confidence > 0.85) {
  return { phase: Phase.SEARCHING };  // Действуем автономно
}

// Если уверенность низкая — тогда спрашиваем
const isConfirmed = interrupt({
  question: `Ищем ${role} в ${countries}?`,
});
```

### Streaming

```typescript
// Показываем прогресс в реальном времени
for await (const update of graph.stream(input, config)) {
  if (update.searching) {
    await bot.editMessage("🔍 Ищу...");
  }
  if (update.results) {
    await bot.editMessage(formatResults(update.data));
  }
}
```

---

## Пример диалога (рекомендуемый UX)

```
User: "Я senior backend из Берлина, хочу в product"

Bot: 🔍 Ищу переходы Backend → Product Manager...
     ✓ Найдено 5 waymates с похожим переходом

     Топ matches:

     1️⃣ Alice (Берлин)
        • Backend Lead → Product Manager (2 года)
        • Совпадение навыков: 4/5

     2️⃣ Bob (Амстердам)
        • Senior Backend → Head of Product (3 года)
        • Совпадение навыков: 3/5

     Интересно увидеть полные карьерные пути?
     Или отфильтровать по годам перехода?

User: "Покажи пути"

Bot: 🔄 Загружаю pathfinders...

     Частый паттерн (3+ человека):
     Backend → Senior → Staff → Product Manager
     Длительность: 4-6 лет

     Доступно в: Берлин, Амстердам, Лондон

     Хотите примеры этого пути?
```

---

## План реализации

### Фаза 1: Quick Wins (2-3 дня)
- Убрать `asking_adhoc_context` interrupt → извлекать из первого сообщения
- Убрать `asking_search_mode` interrupt → выводить из intent
- Объединить validate + clarify

### Фаза 2: Core Refactor (4-5 дней)
- Добавить intent classification LLM с confidence
- Упростить фазы (18 → 5)
- Routing по confidence thresholds

### Фаза 3: Streaming (2-3 дня)
- Telegram bot: `.stream()` вместо `.invoke()`
- Progress messages (🔍 Ищу...)
- Progressive disclosure результатов

---

## Источники

- [AI Conversational Design - UX WRITING HUB](https://uxwritinghub.com/ai-conversational-design-natural-language-processing/)
- [Conversational AI Design in 2025 - Botpress](https://botpress.com/blog/conversation-design)
- [Chatbot UX Design Guide 2025 - Parallel](https://www.parallelhq.com/blog/chatbot-ux-design)
- [8 Principles for Conversational UX - Bryan Larson](https://www.bryanlarson.ca/blog/2025/7/20/8-principles-for-conversational-ux-design)
- [Multi-stage Clarification in Conversational AI - ArXiv](https://ar5iv.labs.arxiv.org/html/2110.15235)
- [Making it easier to build human-in-the-loop agents - LangChain Blog](https://blog.langchain.com/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt/)
- [Human-in-the-loop - LangGraph Concepts](https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/)

---

## Вывод

**Рекомендация:** Intent-Driven + Confidence Routing

Это даёт:
- Минимум interrupts (1-2 вместо 4-6)
- "Живой разговор" вместо "заполнения формы"
- ~40% меньше кода
- Streaming для ощущения "живости"

**Ключевой trade-off:** Меньше явного контроля пользователя → больше автономии системы. Но это именно то, что нужно для "живого простого разговора".
