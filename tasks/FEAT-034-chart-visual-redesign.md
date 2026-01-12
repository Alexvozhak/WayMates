# FEAT-034: Chart Visual Redesign

**Статус:** PENDING
**Приоритет:** TBD (MVP или Post-MVP)
**Дата:** 2025-12-21
**Автор:** mvp-research

---

## 1. Цель

Улучшить визуальный дизайн Career Trajectory Chart для лучшего UX и эстетики.

---

## 2. Текущее состояние

- Plotly.js с базовыми стилями
- Светлая тема
- Функционал работает (dynamic levels, goal lines, DTW radar)
- Визуально "не айс" (feedback пользователя)

---

## 3. Результаты ресёрча

### 3.1 Timeline/Career Focused

| Ресурс | Тип | Описание | Ссылка |
|--------|-----|----------|--------|
| **Dribbble Timeline** | Галерея | 7000+ дизайнов timeline | [dribbble.com/tags/timeline](https://dribbble.com/tags/timeline) |
| **Work Timeline** | Галерея | Специфично для карьеры | [dribbble.com/tags/work-timeline](https://dribbble.com/tags/work-timeline) |
| **Nightingale** | Статья | Step-линии для карьерного пути | [nightingaledvs.com](https://nightingaledvs.com/how-i-used-data-visualization-to-showcase-my-career-trajectory/) |

### 3.2 Dashboard Themes (Dark/Light)

| Ресурс | Тип | Описание | Ссылка |
|--------|-----|----------|--------|
| **Figma Dashboard** | Шаблон | Dark + Light toggle, color variables | [Figma Community](https://www.figma.com/community/file/1284628698171304551/dashboard-dark-and-light-modes-color-variables) |
| **Dribbble Dark Dashboard** | Галерея | 400+ dark UI примеров | [dribbble.com/tags/dark-dashboard](https://dribbble.com/tags/dark-dashboard) |
| **Dashkit Bootstrap** | Шаблон | Charts.js, 5 layouts | [Bootstrap Themes](https://themes.getbootstrap.com/product/dashkit-admin-dashboard-template/) |

### 3.3 Plotly (текущая библиотека)

| Ресурс | Тип | Описание | Ссылка |
|--------|-----|----------|--------|
| **Gantt Charts** | Документация | px.timeline API | [plotly.com/python/gantt](https://plotly.com/python/gantt/) |
| **Animated Timeline** | Tutorial | Анимированные графики | [Plotly Forum](https://community.plotly.com/t/beautiful-animated-timeline-graphs-tutorial/83856) |
| **CodePen JS** | Пример | Рабочий код на JS | [codepen.io](https://codepen.io/elv1s42/pen/bKVEJb) |

### 3.4 D3.js (альтернатива)

| Ресурс | Тип | Описание | Ссылка |
|--------|-----|----------|--------|
| **d3-milestones** | Библиотека | Career milestones, агрегация по годам | [GitHub](https://github.com/walterra/d3-milestones) |
| **d3-timeline** | Библиотека | Drag/zoom, hover events | [Demo](https://denisemauldin.github.io/d3-timeline/) |
| **patternfly-timeline** | Библиотека | Event series visualization | [GitHub](https://github.com/patternfly/patternfly-timeline) |

---

## 4. Варианты реализации

### A. Минимальные изменения (~50 LOC)

**Scope:**
- Dark theme toggle
- Улучшенная цветовая палитра
- Мелкие CSS правки

**Плюсы:** Быстро, не ломает существующий код
**Минусы:** Косметические улучшения

### B. Визуальный редизайн (~150 LOC)

**Scope:**
- Выбрать референс из Dribbble/Figma
- Переделать CSS + цвета
- Улучшить typography и spacing
- Возможно dark theme по умолчанию

**Плюсы:** Значительное улучшение UX
**Минусы:** Требует дизайн-решения

### C. Переход на D3.js (~400 LOC)

**Scope:**
- Рефакторинг с Plotly на D3.js
- d3-milestones или d3-timeline
- Полный контроль над визуализацией

**Плюсы:** Максимальная кастомизация
**Минусы:** Большой рефакторинг, риски

---

## 5. Рекомендация

**Вариант B** — визуальный редизайн на Plotly.

Причины:
1. Plotly уже работает и проверен
2. 150 LOC — управляемый scope
3. Не требует изучения новой библиотеки
4. Dark theme популярен и улучшает читаемость графиков

---

## 6. Зависимости

- [FEAT-031](./FEAT-031-chart-browser-build.md) — esbuild компиляция browser JS (P2)

---

## 7. Acceptance Criteria

- [ ] Выбран визуальный референс (Dribbble/Figma)
- [ ] Реализован выбранный вариант (A/B/C)
- [ ] Dark theme (опционально, по решению)
- [ ] Smoke test пройден
- [ ] Пользователь подтвердил что "теперь айс"

---

## 8. TODO

1. [ ] Пользователь выбирает референс из ссылок выше
2. [ ] Определить приоритет (MVP / Post-MVP)
3. [ ] Выбрать вариант реализации (A/B/C)
4. [ ] Реализация
