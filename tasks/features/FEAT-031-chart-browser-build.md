# FEAT-031: Chart Browser Build (esbuild)

**Статус:** PENDING
**Приоритет:** P2
**Зависит от:** Chart Service (✅ DONE)
**Блокирует:** Dockerfile improvements (компиляция TS)

---

## Проблема

Сейчас ~400 строк JavaScript для браузера написаны как template literal строки в `html-renderer.ts`:

```typescript
private buildTraceBuilders(): string {
  return `
    function buildTracesForField(field, xaxisId, yaxisId, enabledCandidates) {
      // ~50 строк JS как текст
    }
  `;
}
```

**Минусы:**
- Нет типизации JS кода
- Нет IDE поддержки (автокомплит, рефакторинг)
- Сложно читать и поддерживать
- Ошибки обнаруживаются только в runtime (браузере)

---

## Решение

Вынести browser-код в отдельный TypeScript файл, компилировать через esbuild.

### Архитектура

```
src/chart/browser/
├── chart-runtime.ts     ← TypeScript с типами (новый)
└── index.ts             ← export

scripts/
└── build-chart-runtime.ts  ← esbuild скрипт (новый)

dist/chart/browser/
└── chart-runtime.js     ← скомпилированный JS (генерируется, НЕ в git)
```

### Ключевые решения

| Вопрос | Решение | Почему |
|--------|---------|--------|
| `dist/chart-runtime.js` в git? | **Нет** | Стандарт, чистый репо, нет рассинхрона |
| Когда собирать? | **При `npm run build`** | Простота, один step, ошибки видны сразу |
| Куда класть? | **`dist/chart/browser/`** | Зеркалит src/, относительный путь надёжен |

### Workflow

```
1. npm run build:chart
   ↓
2. esbuild компилирует src/chart/browser/chart-runtime.ts
   ↓
3. Результат записывается в dist/chart/browser/chart-runtime.js
   ↓
4. npm run build (tsc) компилирует остальной TypeScript
   ↓
5. При генерации HTML (runtime):
   - Читаем dist/chart/browser/chart-runtime.js как строку
   - Вставляем в <script> вместе с данными
```

### Код

**scripts/build-chart-runtime.ts:**
```typescript
import { buildSync } from 'esbuild';
import { mkdirSync } from 'fs';

// Создаём директорию если не существует
mkdirSync('dist/chart/browser', { recursive: true });

buildSync({
  entryPoints: ['src/chart/browser/chart-runtime.ts'],
  outfile: 'dist/chart/browser/chart-runtime.js',
  bundle: true,
  minify: true,
  target: 'es2020',
});

console.log('✅ Chart runtime compiled to dist/chart/browser/chart-runtime.js');
```

**html-renderer.ts (после рефакторинга):**
```typescript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM-совместимый способ получить __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Читаем скомпилированный JS один раз при старте
// Путь относительно скомпилированного html-renderer.js в dist/chart/
const CHART_RUNTIME_JS = readFileSync(
  join(__dirname, './browser/chart-runtime.js'),
  'utf-8'
);

private buildScript(): string {
  const chartDataJson = JSON.stringify({...});

  return `<script>
    const chartData = ${chartDataJson};
    ${CHART_RUNTIME_JS}
  </script>`;
}
```

---

## npm scripts

```json
{
  "scripts": {
    "build:chart": "tsx scripts/build-chart-runtime.ts",
    "build": "npm run build:chart && tsc",
    "dev": "npm run build:chart && tsx watch ..."
  }
}
```

---

## Scope

| Файл | Действие | LOC |
|------|----------|-----|
| `src/chart/browser/chart-runtime.ts` | Создать (перенести JS код) | ~400 |
| `src/chart/browser/types.ts` | Типы для browser runtime | ~50 |
| `scripts/build-chart-runtime.ts` | esbuild скрипт | ~25 |
| `html-renderer.ts` | Удалить 6 методов buildXxx(), обновить import | -350 |
| `package.json` | npm scripts | ~5 |
| `.gitignore` | Убедиться что `dist/` исключён | 0 |

**Итого:** ~130 LOC новых, ~350 удалено, net: -220 LOC

---

## Acceptance Criteria

- [ ] `npm run build:chart` компилирует TS → JS
- [ ] `dist/chart/browser/chart-runtime.js` создаётся (~15KB minified)
- [ ] `dist/` в `.gitignore` (не коммитим генерируемые файлы)
- [ ] HTML генерация работает как раньше
- [ ] Smoke test проходит (`poc/smoke-test-chart.ts`)
- [ ] IDE поддержка в `chart-runtime.ts` (типы, автокомплит)
- [ ] Docker build работает (`npm run build` включает `build:chart`)

---

## Зависимости

- `esbuild` — уже есть (используется tsx)

---

## Риски

| Риск | Митигация |
|------|-----------|
| Забыть `npm run build:chart` перед деплоем | Включён в `npm run build` |
| Путь к dist/ в Docker | Относительный путь `./browser/` — работает везде |
| ESM `__dirname` не работает | Используем `import.meta.url` + `fileURLToPath` |

---

## Связь с другими задачами

- **Dockerfile improvements**: После FEAT-031, `npm run build` будет включать и `build:chart` и `tsc`. Dockerfile с `RUN npm run build` автоматически соберёт всё.
- **FEAT-036 (repo split)**: `dist/` не коммитится → меньше мусора при split.

---

## Ссылки

- [esbuild API](https://esbuild.github.io/api/)
- [esbuild write:false](https://github.com/evanw/esbuild/issues/496)
- [ESM __dirname replacement](https://nodejs.org/api/esm.html#importmetaurl)
- Chart Service: `src/chart/`
