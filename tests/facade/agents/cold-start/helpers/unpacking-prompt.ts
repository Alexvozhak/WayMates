import type { Trail, UserContext } from "../../../../../src/shared/schemas.js";

export type FixtureData = {
  userId: string;
  currentContextId?: string;
  contexts: UserContext[];
  trails: Trail[];
};

export function buildUnpackingPrompt(fixture: FixtureData): string {
  const fixtureJson = JSON.stringify(fixture, null, 2);

  return `Ты помогаешь пользователю рассказать свою карьерную историю на основе структурированных данных.

## Входные данные

JSON с контекстами (contexts) и тропами (trails) пользователя.

## Задача

Преобразовать JSON в естественный рассказ от первого лица про карьерную историю.

---

## Правила

### Язык и стиль
- От первого лица: "Я работал...", "Я перешёл...", "Я начинал..."
- Естественный язык: как будто человек рассказывает другу
- Хронологический порядок: от старого контекста к новому (по createdAt)

### Что включать для каждого контекста

1. Позицию (position): junior, middle, senior
2. Домены (domains): frontend, backend, devops, qa
3. Навыки (skills): ключевые технологии
4. Локацию (cityName, countryCode): город и страна
5. Индустрию (industry): tech, finance, healthcare (если есть)
6. Причины смены (creationReason): зачем сменил работу/позицию

### Как вплетать trails (тропы)

Trails - это обучающие активности между карьерными позициями.

**Связь**: trail.fromContextId -> trail.toContextId

**Формат вплетения**:
- "Между [предыдущей] и [следующей] позицией я прошёл курс [courseName] на [platform], изучал [skill]"
- "Для перехода на [позицию] я прошёл обучение: [описание trail]"
- Если есть totalDurationWeeks: "курс занял X недель"
- Если есть costUsd: "заплатил $X"

**Пример**:
"Чтобы перейти с middle на senior, я прошёл курс System Design на Coursera. Это заняло 8 недель."

### Что НЕ упоминать

- Технические ID: contextId, userId, trailId
- Даты в ISO формате: вместо "2022-01-01T00:00:00Z" пиши "в 2022 году"
- Структурные данные: не называй поля JSON

---

## Особые случаи

### Множественные домены
domains: ["frontend", "backend"]
-> "Я работал fullstack разработчиком"

### Смена страны
cityName: "Berlin", countryCode: "de"
-> "Переехал в Берлин, Германия"

### Множественные причины смены
creationReason: ["position_changed", "company_changed"]
-> "Сменил компанию и одновременно повысился"

### Trail ведёт к первому контексту (fromContextId: null)
-> "До первой работы я прошёл курс X, чтобы подготовиться"

### Несколько trails к одному контексту
-> Перечисли все: "Для перехода я прошёл: курс A и курс B"

---

## Формат вывода

ТОЛЬКО текст, без JSON, без markdown.
Абзацы разделяй пустой строкой.
3-6 абзацев в зависимости от количества контекстов.

---

## JSON для преобразования

\`\`\`json
${fixtureJson}
\`\`\``;
}
