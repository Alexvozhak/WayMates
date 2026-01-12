# Session: FEAT-036 Repo Split + Vitest Path Aliases

**Дата:** 2026-01-12
**Фокус:** Phase 4 git submodule + исправление Vitest path aliases

---

## Что сделано

### Phase 4: Git Submodule (УСПЕШНО)
- Закоммичен Phase 2: `0704180 refactor(repo-split): move core/cypher/database/tests to private/`
- Инициализирован `waymates-core` repo в `private/`
- Запушен в GitHub: `git@github.com:Alexvozhak/waymates-core.git` (ветка `main`)
- Добавлен как submodule: `adb8e33 feat(repo-split): add waymates-core as git submodule`
- Закоммичен cleanup документов: `8009612 chore: cleanup obsolete documentation`

### Обновление версий
- Node.js: обновлён tsconfig на `ES2024` + `nodenext` (для Node 24 LTS)
- Vitest: обновлён с 3.2.4 → 4.0.17, затем откачен до 3.2.4
- Vite: обновлён до 7.3.1

### Vitest Path Aliases (НЕ РЕШЕНО)
Попытки исправить path aliases для тестов:
1. `vite-tsconfig-paths` плагин — не работает с `moduleResolution: nodenext`
2. `resolve.alias` на top level — не применяется
3. `test.alias` — работает только для тестовых файлов, не для imported production code
4. `resolve.tsconfigPaths: true` — не существует в Vite 7
5. `server.deps.inline` — не помогло
6. `allowJs: true` — не помогло

**Первопричина:** `moduleResolution: nodenext` несовместим с Vite/Vitest path aliases. Vite использует bundler-style resolution, Node.js ESM nodenext требует `.js` расширения и не поддерживает aliases нативно.

---

## Что нужно откатить/причесать

### КРИТИЧНО — откатить перед следующей сессией:

1. **tsconfig.json** — убрать `"allowJs": true` (добавлено для отладки)
   ```bash
   # Строка 36
   ```

2. **vitest.config.ts** — грязное состояние, нужно вычистить:
   - Убрать import `vite-tsconfig-paths`
   - Убрать `plugins: [tsconfigPaths(...)]`
   - Подготовить для subpath imports решения

3. **package.json** — может понадобиться откат версий:
   - vitest@3.2.4 (текущая)
   - vite@7.3.1 (текущая)

### НЕ коммитить:
- Текущее состояние vitest.config.ts (грязное)
- allowJs в tsconfig.json

---

## Что осталось сделать

### FEAT-036 Repo Split:
- [ ] **Phase 4.5**: Исправить Vitest path aliases через Subpath Imports
- [ ] **Phase 5**: CI/CD + Dependabot + Codecov
- [ ] **Phase 6-7**: README, LICENSE, верификация

### Vitest Path Aliases — выбранное решение:
**Subpath Imports в package.json** (нативный Node.js ESM способ):

```json
// package.json
{
  "imports": {
    "#core/*": "./private/core/*",
    "#database/*": "./private/database/*",
    "#shared/*": "./src/shared/*",
    "#prompts/*": "./private/prompts/*",
    "#cypher/*": "./private/cypher/*"
  }
}
```

**Требуется:**
1. Добавить `imports` в package.json
2. Обновить tsconfig.json paths: `@xxx/*` → `#xxx/*`
3. Массовая замена во всех файлах: `@core/` → `#core/`, etc.
4. Использовать MCP filesystem для batch операций

---

## Полезные ссылки и артефакты

### Документация:
- [Vitest Common Errors](https://vitest.dev/guide/common-errors) — про aliases
- [Vitest Config Alias](https://vitest.dev/config/alias.html) — `test.alias` vs `resolve.alias`
- [TypeScript Node Target Mapping](https://github.com/microsoft/typescript/wiki/Node-Target-Mapping) — ES2024 для Node 24
- [Using subpath imports](https://webpro.nl/articles/using-subpath-imports-and-path-aliases) — нативный способ

### Ключевые находки:
1. `moduleResolution: nodenext` + Vite = несовместимы для path aliases
2. `test.alias` работает только для тестовых файлов
3. `resolve.alias` должен быть на top level, но не работает с nodenext
4. Subpath imports (`#xxx`) — единственный способ для nodenext без bundler

### GitHub Issues:
- [vitest #2303](https://github.com/vitest-dev/vitest/discussions/2303) — Is nodenext supported?
- [vitest #4722](https://github.com/vitest-dev/vitest/issues/4722) — resolve.alias not working

---

## Текущее состояние репозиториев

### WayMates (главный):
- Ветка: `feature/search-refactor`
- Коммиты: 3 ahead of origin (НЕ запушены)
- Состояние: грязное (vitest.config.ts, tsconfig.json)

### waymates-core (submodule):
- Ветка: `main`
- Статус: синхронизирован с origin
- Содержит: core, cypher, database, prompts, tests

---

## Промпт для продолжения после rewind

```
Продолжаем FEAT-036 Repo Split. Прочитай sessions/2026-01-12-repo-split-vitest.md для контекста.

Текущее состояние:
- Phase 4 ✅ Done (git submodule настроен)
- Vitest path aliases ❌ НЕ работают с moduleResolution: nodenext

Следующий шаг:
1. Откатить грязные изменения (allowJs в tsconfig, мусор в vitest.config)
2. Реализовать Subpath Imports (#xxx) через MCP filesystem:
   - Добавить imports в package.json
   - Массовая замена @xxx/ → #xxx/ во всех файлах
   - Обновить tsconfig.json paths
3. Запустить тесты, убедиться что работает
4. Продолжить Phase 5: CI/CD

Используй mcp__filesystem для batch операций замены.
```
