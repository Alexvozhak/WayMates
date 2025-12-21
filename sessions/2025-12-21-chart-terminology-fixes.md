# Сессия 2025-12-21: Chart — Терминология и Фиксы

## Фаза 1: Изучение и терминология

### Что сделано

1. **Изучил архитектуру Chart модуля** (`src/chart/`)
   - ChartBuilder → TrajectoryTransformer → OverlapCalculator → HtmlRenderer
   - Plotly.js для визуализации, Cloudflare R2 для хостинга

2. **Зафиксировал терминологию GUI-компонентов** (Группа A — технические):
   | Элемент | Термин | Бизнес-смысл |
   |---------|--------|--------------|
   | Main Chart | **Trajectory Chart** | Графики траекторий по аспектам |
   | Subplot | **Aspect Panel** | Панель одного аспекта (Grade, Domain, City, Industry) |
   | Overlap Timeline | **Overlap Timeline** | Периоды полного совпадения всех аспектов (User + Candidate были "коллегами") |
   | Connection Lines | **Projection Lines** | Вертикальные линии от Overlap до Aspect Panels (верификация) |
   | Spider Chart | **DTW Radar** | Радар DTW метрик (Shape, Tempo, Stability) |
   | Goal Line | **Goal Line** | Горизонтальная пунктирная линия цели пользователя |
   | Goal Marker | **Goal Star** | ⭐ на дате когда Pathfinder достиг цели |

3. **Понял бизнес-логику DTW метрик**:
   - Shape = похожесть формы траекторий (какие шаги карьеры)
   - Tempo = похожесть скорости изменений (метания vs плавный рост)
   - Stability = равномерность развития (меньше растяжений в DTW)

4. **Понял ценность Chart для пользователя**:
   - "Вот конкретные люди, у которых можно учиться"
   - "До цели примерно X лет, судя по Проводникам"
   - Actionable: понять что на верном пути, скорректировать стратегию

### Что исправлено

1. **Баг с opacity траектории Pathfinder** — убрал разделение "path to goal" / "after" с разной прозрачностью. Теперь траектория одного цвета от начала до конца.

2. **Легенда Goal Line** — изменил "Goal: middle" → "Ваша цель"

3. **Создал корректные тестовые данные** (`poc/test-overlap-chart.ts`):
   - User: junior, ЕЩЁ НЕ достиг цели
   - Pathfinder: достиг middle РАНЬШЕ User
   - Overlap: период когда оба были junior

4. **Актуализировал `docs/facade/CHART-SERVICE-DESIGN.md`**:
   - Добавил секцию "GUI Терминология и Бизнес-смысл" (таблицы компонентов, ролей, метрик)
   - Добавил секцию FAQ (5 вопросов-ответов)
   - Обновил статус DRAFT → APPROVED
   - Добавил ссылку `@see` в `src/chart/index.ts`

### Что НЕ сделано (выносим в следующую задачу)

1. **Динамические levels для аспектов** — сейчас levels захардкожены только для position (`junior/middle/senior/lead`). Для domains, cityName, industry levels = [], поэтому Goal Line не рисуется на этих аспектах.

   **Нужно**: собирать уникальные значения из User + Candidates для каждого field и использовать как levels.

2. **Ресёрч визуальных шаблонов** — собрал ссылки (Dribbble, Behance, Plotly), но не выбрал конкретный стиль.

---

## Фаза 2: Динамические levels + role аспект

### Что сделано

1. **Добавлен тип `DynamicLevels`** (`src/chart/types.ts`):
   ```typescript
   export type DynamicLevels = Partial<Record<ChartableField, string[]>>;
   ```

2. **Добавлен аспект `role`**:
   - `CHARTABLE_FIELDS`: добавлен `"role"`
   - `ASPECT_CONFIGS`: добавлен конфиг для role
   - `DEFAULT_FIELDS`: добавлен role
   - `FIELD_LABELS`: добавлен Role

3. **Динамический сбор levels** (`chart-builder.ts`):
   - Метод `calculateDynamicLevels()` собирает уникальные значения из всех точек всех траекторий
   - Передаётся в `HtmlRenderer` через `ChartRenderData`

4. **JavaScript использует динамические levels** (`html-renderer.ts`):
   - `chartData.dynamicLevels` передаётся в браузер
   - `getFieldConfig(field)` берёт levels из `chartData.dynamicLevels[field]`
   - Goal Line теперь работает на ВСЕХ аспектах где есть цель

### Quality gates
- ✅ `npx tsc --noEmit` — pass
- ✅ `npm run lint` — pass
- ✅ Smoke test `poc/smoke-test-chart.ts` — pass

### Что НЕ сделано

1. **Ресёрч визуальных шаблонов** — отложено
2. **Рефакторинг JS-строк в html-renderer.ts** — технический долг (см. рефлексию)

---

## Рефлексия (сквозная)

### Как делать правильно

- **Уточнять бизнес-смысл перед кодом** — задавать вопросы по каждому GUI элементу, пока уверенность не 90%+
- **Проверять тестовые данные на логическую корректность** — Pathfinder должен достичь цели РАНЬШЕ User
- **Использовать Puppeteer для визуальной верификации** — скриншоты показывают реальное состояние
- **Собирать данные из источника, не хардкодить** — динамические levels из trajectories

### Как делать неправильно

- Генерировать тестовые данные без проверки бизнес-логики (User достигает цели раньше Pathfinder — бессмысленно)
- Хардкодить levels только для одного поля (position), забывая про остальные
- Разделять траекторию на "до цели / после цели" с разной opacity без согласования

### Инсайты

1. **Overlap = когда ВСЕ аспекты совпадают одновременно** — не по отдельности, а пересечение всех
2. **End date context-а = createdAt следующего context-а** — неявное соглашение в данных
3. **Для User с 1 context overlap не посчитается** — цикл `for (ui = 0; ui < userPoints.length - 1)` не выполнится
4. **Inline JS в HTML — технический долг** — для standalone HTML это работает, но неудобно читать и нет типизации. Решение: esbuild компиляция отдельного TS файла в JS-строку при сборке.

### Наставления от пользователя

1. **"Траектория должна быть одного цвета от начала до конца"** — не разделять на path to goal / after
2. **"Тестовые данные некорректны — User достиг цели раньше Pathfinder"** — всегда проверять логику данных
3. **"Все словарные значения должны браться из данных, а не хардкодиться"** — динамические levels для всех аспектов
4. **"Легенда: Вы + Ваша цель"** — понятная терминология для пользователя
5. **"Роль и ЗП нужны в аспектах"** — добавил role, salaryExact уже был

### Технический долг

| Что | Почему | Решение |
|-----|--------|---------|
| JS как строки в `html-renderer.ts` | Нужен standalone HTML | Esbuild: `src/chart/browser/chart.ts` → компилировать в JS-строку при сборке |

---

## Фаза 3: Документирование и тестирование

### Что сделано

1. **Закоммичено**: `4b36cba feat(chart): dynamic levels + role aspect`
   - 8 файлов, +445/-71 строк
   - Quality gates: tsc ✅, lint ✅, smoke test ✅

2. **Создана задача FEAT-031** (`tasks/features/FEAT-031-chart-browser-build.md`):
   - Рефакторинг inline JS → esbuild компиляция
   - Приоритет P2 (технический долг)
   - Scope: ~400 LOC перенести в `src/chart/browser/chart-runtime.ts`

3. **Обновлён MVP-RELEASE-PLAN.md**:
   - Добавлена строка Chart Browser Build в таблицу фич
   - Отмечены выполненные: dynamic levels ✅, role ✅

4. **Puppeteer тестирование графика**:
   - Aspect checkboxes — работают
   - Candidate checkboxes — работают
   - Show connection lines — работает (пусто = нет overlap)
   - Dynamic levels — работают (paris/berlin, frontend/backend)
   - Goal Line — на Grade и Domain
   - Goal Star ⭐ — появляется/скрывается с Pathfinder
   - Spider Chart — обновляется при toggle
   - **GUI баги НЕ закрыты** — требуется проверка пользователем

### Обсуждённые концепции

**Почему JS как строки в html-renderer.ts:**
- Генерируем standalone HTML файл
- HTML загружается в R2, открывается в браузере
- Браузер выполняет JS внутри HTML
- TypeScript "печатает" JS как текст в файл

**Решение (FEAT-031):**
```
npm run build:chart
  ↓
esbuild: src/chart/browser/chart-runtime.ts → dist/chart-runtime.js
  ↓
При генерации HTML: читаем dist/chart-runtime.js, вставляем в <script>
```

---

## Рефлексия (сквозная)

### Как делать правильно

- **Уточнять бизнес-смысл перед кодом** — задавать вопросы по каждому GUI элементу, пока уверенность не 90%+
- **Проверять тестовые данные на логическую корректность** — Pathfinder должен достичь цели РАНЬШЕ User
- **Использовать Puppeteer для визуальной верификации** — скриншоты показывают реальное состояние
- **Собирать данные из источника, не хардкодить** — динамические levels из trajectories
- **Объяснять архитектурные решения просто** — "печатаем JS в текстовый файл"

### Как делать неправильно

- Генерировать тестовые данные без проверки бизнес-логики (User достигает цели раньше Pathfinder — бессмысленно)
- Хардкодить levels только для одного поля (position), забывая про остальные
- Разделять траекторию на "до цели / после цели" с разной opacity без согласования
- Предполагать что пользователь знает веб-архитектуру (объяснять с нуля)

### Инсайты

1. **Overlap = когда ВСЕ аспекты совпадают одновременно** — не по отдельности, а пересечение всех
2. **End date context-а = createdAt следующего context-а** — неявное соглашение в данных
3. **Для User с 1 context overlap не посчитается** — цикл `for (ui = 0; ui < userPoints.length - 1)` не выполнится
4. **Inline JS в HTML — технический долг** — для standalone HTML это работает, но неудобно читать и нет типизации
5. **esbuild с write:false** — возвращает Uint8Array, нужен TextDecoder (или просто write в файл и потом читать)

### Наставления от пользователя

1. **"Траектория должна быть одного цвета от начала до конца"** — не разделять на path to goal / after
2. **"Тестовые данные некорректны — User достиг цели раньше Pathfinder"** — всегда проверять логику данных
3. **"Все словарные значения должны браться из данных, а не хардкодиться"** — динамические levels для всех аспектов
4. **"Легенда: Вы + Ваша цель"** — понятная терминология для пользователя
5. **"Роль и ЗП нужны в аспектах"** — добавил role, salaryExact уже был
6. **"Объясняй проще"** — не предполагать знание веб-архитектуры
7. **"Баги не закрывай пока я не проверил"** — визуальная верификация пользователем обязательна

### Технический долг

| Что | Почему | Решение | Задача |
|-----|--------|---------|--------|
| JS как строки в `html-renderer.ts` | Нужен standalone HTML | esbuild компиляция | [FEAT-031](../../tasks/features/FEAT-031-chart-browser-build.md) |

---

## Фаза 4: Layout фиксы + ресёрч визуальных шаблонов

### Что сделано

1. **Создана FEAT-034** (`tasks/features/FEAT-034-chart-visual-redesign.md`):
   - Ресёрч визуальных шаблонов: Dribbble, Figma, Plotly, D3.js
   - 3 варианта реализации: A (minimal ~50 LOC), B (redesign ~150 LOC), C (D3 migration ~400 LOC)
   - Рекомендация: Вариант B
   - Приоритет: P2 (Post-MVP)
   - Коммит: `00dfa07 docs: add FEAT-034 chart visual redesign research`

2. **Настроен Hyprland для Puppeteer**:
   ```conf
   # ~/.config/hypr/hyprland.conf
   windowrulev2 = workspace 2 silent, class:^(cursor)$
   windowrulev2 = noinitialfocus, class:^(cursor)$
   windowrulev2 = size 1600 900, class:^(cursor)$
   ```
   - Puppeteer Chrome for Testing имеет class `cursor` (не `chromium`)
   - Теперь окно открывается на workspace 2 без перехвата фокуса

3. **Layout фиксы** (`src/chart/builders/html-renderer.ts`):
   - `max-width: 1400px` → `max-width: 95%` (для ultrawide мониторов 3440x1440)
   - `margin: { r: 150, t: 60 }` → `margin: { l: 150, r: 150, t: 60 }` (labels не обрезаются)

### Quality gates
- ✅ `npm run lint` — pass
- ✅ `npx tsc --noEmit` — pass
- ✅ Puppeteer визуальная проверка — pass

### Ссылки из ресёрча

| Категория | Ресурс | Ссылка |
|-----------|--------|--------|
| Timeline | Dribbble Timeline | [dribbble.com/tags/timeline](https://dribbble.com/tags/timeline) |
| Dashboard | Figma Dark/Light | [Figma Community](https://www.figma.com/community/file/1284628698171304551) |
| Dashboard | Dribbble Dark Dashboard | [dribbble.com/tags/dark-dashboard](https://dribbble.com/tags/dark-dashboard) |
| Plotly | Gantt Charts | [plotly.com/python/gantt](https://plotly.com/python/gantt/) |
| D3.js | d3-milestones | [GitHub](https://github.com/walterra/d3-milestones) |

---

## Рефлексия (сквозная)

### Как делать правильно

- **Уточнять бизнес-смысл перед кодом** — задавать вопросы по каждому GUI элементу, пока уверенность не 90%+
- **Проверять тестовые данные на логическую корректность** — Pathfinder должен достичь цели РАНЬШЕ User
- **Использовать Puppeteer для визуальной верификации** — скриншоты показывают реальное состояние
- **Собирать данные из источника, не хардкодить** — динамические levels из trajectories
- **Объяснять архитектурные решения просто** — "печатаем JS в текстовый файл"
- **Проверять разрешение экрана пользователя** — `hyprctl monitors` показывает реальные размеры

### Как делать неправильно

- Генерировать тестовые данные без проверки бизнес-логики
- Хардкодить levels только для одного поля
- Разделять траекторию на "до цели / после цели" с разной opacity без согласования
- Предполагать что пользователь знает веб-архитектуру
- Использовать фиксированные размеры без учёта разрешения экрана (1400px на ultrawide)

### Инсайты

1. **Overlap = когда ВСЕ аспекты совпадают одновременно** — не по отдельности, а пересечение всех
2. **End date context-а = createdAt следующего context-а** — неявное соглашение в данных
3. **Для User с 1 context overlap не посчитается** — цикл `for (ui = 0; ui < userPoints.length - 1)` не выполнится
4. **Inline JS в HTML — технический долг** — для standalone HTML это работает, но неудобно читать
5. **Puppeteer Chrome for Testing имеет class `cursor`** — не `chromium`, поэтому window rules нужны отдельные
6. **Ultrawide монитор 3440x1440** — max-width: 1400px слишком мало, лучше 95%

### Наставления от пользователя

1. **"Траектория должна быть одного цвета от начала до конца"** — не разделять на path to goal / after
2. **"Тестовые данные некорректны — User достиг цели раньше Pathfinder"** — всегда проверять логику данных
3. **"Все словарные значения должны браться из данных, а не хардкодиться"** — динамические levels для всех аспектов
4. **"Легенда: Вы + Ваша цель"** — понятная терминология для пользователя
5. **"Роль и ЗП нужны в аспектах"** — добавил role, salaryExact уже был
6. **"Объясняй проще"** — не предполагать знание веб-архитектуры
7. **"Баги не закрывай пока я не проверил"** — визуальная верификация пользователем обязательна
8. **"Посмотри разрешение экрана"** — `hyprctl monitors` перед настройкой размеров

### Технический долг

| Что | Почему | Решение | Задача |
|-----|--------|---------|--------|
| JS как строки в `html-renderer.ts` | Нужен standalone HTML | esbuild компиляция | [FEAT-031](../../tasks/features/FEAT-031-chart-browser-build.md) |
| Визуальный стиль "не айс" | MVP дизайн | Выбрать референс и переделать | [FEAT-034](../../tasks/features/FEAT-034-chart-visual-redesign.md) |

---

## TODO для следующей сессии

1. [x] ~~Проверить GUI баги~~ — ✅ пользователь подтвердил
2. [x] ~~Ресёрч визуальных шаблонов~~ — ✅ FEAT-034 создана
3. [ ] Выбрать референс из ссылок и применить новый визуальный стиль (FEAT-034)
4. [ ] (P2) FEAT-031: вынести browser JS в отдельный TS файл + esbuild
5. [ ] Закоммитить layout фиксы (max-width, margin.l)

---

## Промпт для rewind

```
Продолжаем сессию Chart. Прочитай sessions/2025-12-21-chart-terminology-fixes.md — там 4 фазы работы.

Текущее состояние:
- Layout фиксы сделаны но НЕ закоммичены (max-width: 95%, margin.l: 150)
- FEAT-034 создана (visual redesign research)
- Hyprland настроен для Puppeteer

Следующий шаг: закоммитить изменения в html-renderer.ts
```
