# FEAT-045: Candidates-Only Chart Mode

**Status**: TODO
**Priority**: P1
**Component**: Chart, Facade (validate-goal), Telegram
**Created**: 2025-12-25
**Depends on**: FEAT-044
**Blocks**: -

---

## Проблема

В фазе validation (asking_after_validate) нет визуализации траекторий кандидатов.
Текстовое описание 10 траекторий нечитаемо. Chart даёт мгновенное понимание паттернов.

---

## Решение

Candidates-only режим Chart:
- **Без userTrajectory** — нет DTW, нет overlaps
- **adhocContext маркер** — точка "Я сейчас здесь" на каждом аспекте
- **Goal line** — горизонтальная линия "Куда хочу"
- **Candidates trajectories** — линии траекторий кандидатов

---

## Схема (согласована)

### GenerateChartInput (обновлённый)

```typescript
type GenerateChartInput = {
  userTrajectory: UserContext[];      // [] для candidates-only mode
  adhocContext?: UserContext;         // ← НОВОЕ: маркер текущей позиции
  candidates: ScoredMatchedCandidate[];
  selectedFields?: ChartableField[];
  maxCandidates?: number;
  locale?: Locale;
  existingGoal?: boolean;
  goalValues?: GoalValues;
};
```

### Логика режимов

| Условие | Режим | DTW | Overlaps | User |
|---------|-------|-----|----------|------|
| `userTrajectory.length > 0` | Full (DTW) | ✅ | ✅ | Линия |
| `userTrajectory.length === 0 && adhocContext` | Candidates-only | ❌ | ❌ | Маркер ● |
| `userTrajectory.length === 0 && !adhocContext` | Error | - | - | - |

---

## Acceptance Criteria

### Chart Module

1. **adhocContext в input**
   - [ ] Добавить `adhocContext?: UserContext` в GenerateChartInput

2. **Candidates-only mode**
   - [ ] `userTrajectory: []` + `adhocContext` → skip DTW, skip overlaps
   - [ ] Убрать throw на пустую userTrajectory если есть adhocContext

3. **Adhoc маркер визуализация**
   - [ ] Точка ● на каждом аспекте (position, role, domains...)
   - [ ] Цвет: тот же что User trajectory (синий?)
   - [ ] Легенда: "Вы (текущая позиция)"

4. **Goal line сохраняется**
   - [ ] Горизонтальная пунктирная линия
   - [ ] Золотой цвет (#fbbf24)

5. **DTW Radar скрыт**
   - [ ] Не рендерить Spider chart в candidates-only mode

### Facade Integration

6. **Chart generation в validate-goal**
   - [ ] Вызов generateTrajectoryChart() после получения candidates
   - [ ] Только если `candidates.length <= MAX_CANDIDATES_FOR_ANALYSIS`
   - [ ] chartUrl в state

7. **Response builder**
   - [ ] chartUrl в asking_after_validate response (когда needsFiltering: false)

### Telegram

8. **Chart link в сообщении**
   - [ ] "📊 [Открыть график траекторий](chartUrl)"
   - [ ] После текстового описания кандидатов

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/chart/types.ts` | adhocContext в GenerateChartInput |
| `src/chart/index.ts` | Логика candidates-only mode |
| `src/chart/builders/chart-builder.ts` | Skip DTW если нет userTrajectory |
| `src/chart/builders/html-renderer.ts` | Adhoc маркер, skip DTW Radar |
| `src/chart/services/trajectory-transformer.ts` | Transform adhocContext в маркер |
| `src/facade/langGraph/search-graph/nodes/validate-goal.ts` | Chart generation |
| `src/facade/langGraph/search-graph/response-builders.ts` | chartUrl в response |

---

## Визуализация

```
┌─────────────────────────────────────────────────────────┐
│  Grade Panel                                             │
│                                                          │
│  senior  ─────────────────────────────────── goal line   │
│          ╱    ╲    ╱                                     │
│  middle ●      ╲  ╱  (adhoc marker)                      │
│         ╲      ╳                                         │
│  junior  ╲────╱ ╲────────                                │
│                                                          │
│  2020    2021    2022    2023    2024                    │
└─────────────────────────────────────────────────────────┘
```

- **●** = adhocContext (текущая позиция пользователя)
- **---** = goal line (цель)
- **линии** = траектории кандидатов

---

## Оценка

| Аспект | Оценка |
|--------|--------|
| LOC | ~80-100 |
| Сложность | Средняя |
| Риск | Средний (визуальные изменения) |

---

## Notes

Визуальная верификация обязательна через Puppeteer MCP после реализации.
Использовать `/mvp-chart` команду для работы с Chart модулем.
