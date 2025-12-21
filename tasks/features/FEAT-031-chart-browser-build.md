# FEAT-031: Chart Browser Build (esbuild)

**Статус:** PENDING
**Приоритет:** P2
**Зависит от:** Chart Service (✅ DONE)

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

dist/
└── chart-runtime.js     ← скомпилированный JS (генерируется)
```

### Workflow

```
1. npm run build:chart
   ↓
2. esbuild компилирует src/chart/browser/chart-runtime.ts
   ↓
3. Результат записывается в dist/chart-runtime.js
   ↓
4. При генерации HTML:
   - Читаем dist/chart-runtime.js как строку
   - Вставляем в <script> вместе с данными
```

### Код

**scripts/build-chart-runtime.ts:**
```typescript
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/chart/browser/chart-runtime.ts'],
  outfile: 'dist/chart-runtime.js',
  bundle: true,
  minify: true,
  target: 'es2020',
});

console.log('✅ Chart runtime compiled to dist/chart-runtime.js');
```

**html-renderer.ts (после рефакторинга):**
```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

// Читаем скомпилированный JS один раз при старте
const CHART_RUNTIME_JS = readFileSync(
  join(__dirname, '../../dist/chart-runtime.js'),
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
| `scripts/build-chart-runtime.ts` | esbuild скрипт | ~20 |
| `html-renderer.ts` | Удалить 6 методов buildXxx() | -350 |
| `package.json` | npm scripts | ~5 |

**Итого:** ~125 LOC новых, ~350 удалено, net: -225 LOC

---

## Acceptance Criteria

- [ ] `npm run build:chart` компилирует TS → JS
- [ ] `dist/chart-runtime.js` создаётся (~15KB minified)
- [ ] HTML генерация работает как раньше
- [ ] Smoke test проходит (`poc/smoke-test-chart.ts`)
- [ ] IDE поддержка в `chart-runtime.ts` (типы, автокомплит)

---

## Зависимости

- `esbuild` — уже есть (используется tsx)

---

## Риски

| Риск | Митигация |
|------|-----------|
| Забыть `npm run build:chart` перед деплоем | Добавить в `npm run build` |
| Путь к dist/ в production | Использовать `__dirname` или env |

---

## Ссылки

- [esbuild API](https://esbuild.github.io/api/)
- [esbuild write:false](https://github.com/evanw/esbuild/issues/496)
- Chart Service: `src/chart/`
