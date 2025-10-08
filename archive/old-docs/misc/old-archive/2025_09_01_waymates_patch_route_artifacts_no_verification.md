# WayMates — Патч: артефакты маршрута, исходы и приращение контекста (без логики достоверности)

_Дата: 2025-09-01_

Этот патч уточняет статистику маршрутов: **что пользователь получает на выходе** (артефакты и исходы) и **как меняется его контекст** (ContextDelta). Применимо к уже принятой модели «цель → маршруты (с шагами и статистикой)». **Логику достоверности/верификации временно исключаем.**

---

## 1) Понятия

- **Artifact (артефакт)** — осязаемый результат шага или всего маршрута, который можно предъявить/сослаться.
  - Примеры: _IELTS TRF №…_, _Cambridge FCE Certificate_, _GitHub repo_, _Portfolio page_, _Visa status letter_, _Job offer letter_, _Ref letter PDF_, _Hackathon award_, _Course completion certificate_.

- **Outcome (исход)** — агрегированная формулировка достигнутого результата, которая входит в KPI маршрута.
  - Примеры: _B2 подтверждён_, _3 проекта в портфолио_, _Оффер принят_, _Виза получена_.

- **ContextDelta (приращение контекста)** — нормализованное изменение профиля пользователя после прохождения шага/маршрута.
  - Примеры: `lang.en.level: B1 → B2`, `portfolio.projects: +3`, `funds.eur: −300`, `visa.stage: submitted`, `skills.react: +1 tier`.

> Примечание: вопросы достоверности/верификации артефактов и исходов в этом патче не рассматриваются.

---

## 2) Маршрут: что видно в статистике

Для каждого маршрута в статистике храним и показываем:

- **Основные исходы** (KPI) и их доли у прошедших (например, _B2 подтверждён — 76%_).
- **Типовые артефакты** на выходе (распределение по видам сертификатов/доказательств).
- **ContextDelta-распределения** (как менялся контекст у большинства).
- **Время/стоимость/усилие** (медиана + p90).

> Всё это работает без сущности «пул»: данные агрегируются по людям, шедшим _данным маршрутом_.

---

## 3) Пример: «English B2» (конец маршрута — B2)

**Исходы (KPI):**
- `english.level == "B2"` — 76%.

**Артефакты (по видам сертификатов):**
- **IELTS Academic/General**: 44%
- **Cambridge FCE/First**: 23%
- **TOEFL iBT**: 12%
- **Duolingo English Test**: 8%
- **Внутренние тесты школы**: 7%
- **Без сертификата (признание работодателем/интервью)**: 6%

**ContextDelta (медиана):**
- `lang.en.level`: **B1 → B2**
- `study.hours_per_week`: **+4 ч/нед**
- `funds.eur`: **−€450**
- `time.months`: **+3.2 мес.**

**Время/стоимость:**
- Медиана времени: **3.1 мес** (p90: 4.6 мес)
- Медиана стоимости: **€380** (p90: €900)

---

## 4) Пример: «Frontend Portfolio (≥3 проекта)»

**Исходы (KPI):**
- `portfolio.projects >= 3` — 68%.

**Артефакты:**
- GitHub repos (public): 91%
- Демо на Vercel/Netlify: 63%
- README с требованиями работодателя: 27%
- Issue/PR в OSS: 18%

**ContextDelta (медиана):**
- `portfolio.projects`: **+3**
- `skills.ts`: **+1 tier**
- `time.months`: **+1.7 мес**
- `funds.eur`: **−€0…€120**

---

## 5) Мини‑схема (TypeBox) для интеграции в Core

```ts
import { Type, Static } from "@sinclair/typebox";

export const ArtifactT = Type.Object({
  kind: Type.String(),                 // "certificate/ielts", "repo/github", "offer/letter"
  title: Type.Optional(Type.String()),
  uri: Type.Optional(Type.String()),   // ссылка или storage key
  ext_ref: Type.Optional(Type.String())// внешний идентификатор (TRF №, etc)
});

export const OutcomeT = Type.Object({
  code: Type.String(),                 // "english.B2", "portfolio.3plus", "offer.accepted"
});

export const ContextDeltaT = Type.Object({
  path: Type.String(),                 // JSONPath-like "lang.en.level"
  from: Type.Optional(Type.Any()),
  to: Type.Any(),
});

export const StepResultT = Type.Object({
  step_id: Type.String(),
  artifacts: Type.Array(ArtifactT),
  outcomes: Type.Array(OutcomeT),
  deltas: Type.Array(ContextDeltaT),
  time_spent_hours: Type.Optional(Type.Number()),
  cost_eur: Type.Optional(Type.Number()),
});

export const RouteStatsT = Type.Object({
  route_id: Type.String(),
  kpi_outcomes: Type.Array(OutcomeT),  // топ‑исходы; доли считаем агрегатором
  artifact_kinds: Type.Array(Type.String()),
  deltas_summary: Type.Array(Type.Object({
    path: Type.String(),
    median: Type.Any(),
    p90: Type.Optional(Type.Any()),
  })),
  time_months: Type.Object({ median: Type.Number(), p90: Type.Number() }),
  cost_eur: Type.Object({ median: Type.Number(), p90: Type.Number() }),
});
```

> Это расширяет наш **Core**: шаги и маршруты остаются, но получают чёткие **артефакты**, **исходы** и **ContextDelta**. Данные собираются через существующий KAG‑контур (NLU → AJV → KAG‑judge → human → user confirm → DB‑mapper), а агрегируются **Route Stats Aggregator**‑ом.

---

## 6) UI‑скетч для превью маршрута (что показываем пользователю)

- **Цель:** _English B2 → Relocation NL_
- **Маршрут (актуальная версия)**: краткие шаги (3–6 bullet‑ов)
- **Исходы (KPI):** _B2 подтверждён — 76%_
- **Артефакты:** распределение по сертификатам (donut)
- **ContextDelta:** ключевые изменения (B1→B2, −€380, +3.1 мес)
- **Время/стоимость:** медиана + p90
- **Рекомендация:** **Recommended** (Match 0.87 с контекстом пользователя)
- **Кнопки:** _Сравнить с альтернативами_ · _Выбрать маршрут_

---

## 7) Совместимость с Roadmap

- **MVP**: фиксируем артефакты/исходы/дельты в `StepResult` и публикуем агрегированные `RouteStats`.
- **Позже**: расширенные донаты/фейлы, A/B сравнение версий маршрута.

📌 Итог: маршруты отличаются **не только шагами**, но и **типом артефактов на выходе** и **тем, как они изменяют контекст**. Верификацию обсудим отдельным патчем позже.
