# Test Router

**Назначение**: Навигация по test-контексту, delegation rules, FAQ

---

## Когда использовать этот роутер

- `/test-review` команда
- После написания/изменения тестов
- Test failures (troubleshooting)
- Не уверен куда идти за контекстом

---

## Структура документов

| Документ | Что содержит | Когда загружать |
|----------|--------------|-----------------|
| **router.md** (этот файл) | Навигация, delegation rules, FAQ | Всегда первым |
| **[standards.md](./standards.md)** | 5 Checks (Coverage Theater, Test Manipulation, Business Goal, Edge Cases, Schema/Cypher Risk) + примеры | Написание тестов, review, qa agent |
| **[workflows.md](./workflows.md)** | Процессы (Test Failure Analysis, Quality Gates, delegation rules детально) | Test failures, перед завершением feature |
| **[test-rules.md](./test-rules.md)** | Dev tips + test-specific mistakes registry | Написание тестов, рефакторинг, code review |
| **[environment.md](./environment.md)** | Vitest config, параллелизация, запуск тестов | Setup окружения, troubleshooting setup issues |

---

## Таблица роутинга (задача → файлы)

| Задача | Загрузить документы | Делегирование |
|--------|---------------------|---------------|
| **Написание нового теста** | standards.md + test-rules.md + environment.md | Main Claude пишет сам → reviewer + qa (mandatory) |
| **Review тестов (`/test-review`)** | standards.md (если < 100 строк сам) | Main Claude (< 100 строк) OR qa agent (> 100 строк) |
| **Test failures** | workflows.md + standards.md | Main Claude (простые) OR qa agent (сложные) |
| **Рефакторинг тестов** | standards.md + test-rules.md | Main Claude → reviewer + qa (mandatory) |
| **Setup окружения** | environment.md | Main Claude |
| **Schema/Cypher changes** | standards.md + workflows.md | Main Claude → qa agent (integration tests!) |

---

## Delegation Rules

### Main Claude (Orchestrator) - Всегда сам

**Planning & Implementation**:
- ✅ Обсуждение тест-плана (interactive с пользователем)
- ✅ Написание тестов (implementation)
- ✅ Чтение test data (data/trails/*.json)
- ✅ Простой review (< 100 строк для `/test-review`)

**Когда НЕ делегировать**:
- Тест-план требует interactive clarification
- Простой unit test (< 50 строк)
- Очевидный fix из FAQ

---

### Reviewer Agent - MANDATORY после написания

**Что проверяет**:
- Синтаксис TypeScript
- ESLint compliance
- DRY violations
- Unused imports/variables

**Когда вызывать**:
- 🔴 **ВСЕГДА** после написания/изменения тестов (mandatory quality gate)
- Рефакторинг тестов
- Integration tests

**Когда НЕ вызывать**:
- Только обсуждение тест-плана (код еще не написан)
- Только чтение тестов для понимания

---

### QA Agent - MANDATORY после написания

**Что проверяет**:
- 5 checks (см. standards.md)
- Fake tests detection
- Business logic alignment
- Test failure root cause analysis

**Когда вызывать**:
- 🔴 **ВСЕГДА** после написания/изменения тестов (mandatory quality gate)
- Test failures (root cause)
- `/test-review` (если > 100 строк)
- Schema/Cypher changes

**Когда НЕ вызывать**:
- Только обсуждение тест-плана
- Тривиальные изменения (добавили один импорт)

---

## Size Thresholds

| Размер теста | Main Claude | Reviewer | QA |
|--------------|-------------|----------|----|
| < 50 строк | Пишу сам | ✅ Вызываю | ✅ Вызываю |
| 50-100 строк | Пишу сам | ✅ Вызываю | ✅ Вызываю |
| 100-200 строк | Пишу сам | ✅ Вызываю | ✅ Вызываю |
| > 200 строк | Пишу сам | ✅ Вызываю | ✅ Обязательно через агента |

**Для `/test-review`**:
- < 100 строк → Main Claude анализирует сам
- \> 100 строк → делегировать qa agent

---

## FAQ

### Q: Тесты падают с "Connection refused"
**A**: Загрузи **environment.md** → Pre-flight Checks
```bash
# Проверка
docker ps | grep neo4j-test

# Если не запущен
npm run test:setup

# Если запущен но broken
npm run docker:test:down && npm run test:setup
```

---

### Q: Integration tests падают после schema change
**A**: Загрузи **standards.md** → "Schema/Cypher Changes Risk" + **workflows.md** → "Test Failure Analysis"

**Root cause**: Mocks скрывают breaking changes в schema.

**Fix**:
1. Проверь integration tests (не unit с моками!)
2. Запусти `npm run test:integration`
3. Если неочевидно → делегируй qa agent

---

### Q: Как избежать coverage theater?
**A**: Загрузи **standards.md** → "Coverage Theater Detection"

**4 вопроса перед assertions**:
1. ❌ Гарантировано Zod? → Skip
2. ❌ Гарантировано математикой? → Skip
3. ✅ Проверяет бизнес-правило? → Keep
4. ✅ Упадет если логика сломается? → Keep

---

### Q: Как запустить только unit tests?
**A**: Загрузи **environment.md** → "Test Commands"
```bash
npm run test:unit
```

---

### Q: Как запустить integration tests без cleanup (для debugging)?
**A**: Загрузи **environment.md** → "Test Commands"
```bash
npm run test:integration:dev  # Setup + run (без docker:test:down)
```

---

## Workflow Examples

### Сценарий 1: Написание нового integration теста
```
User: Напиши integration test для target search
  ↓
Main Claude:
1. Загружает router.md (delegation rules)
2. Обсуждает тест-план с пользователем
3. Загружает standards.md (avoid coverage theater)
4. Загружает test-rules.md (understanding test data)
5. Загружает environment.md (проверка docker ps)
6. Пишет integration test
7. ✅ Вызывает reviewer agent (MANDATORY)
8. ✅ Вызывает qa agent (MANDATORY)
9. Исправляет критические проблемы
10. Запускает quality gates (lint, tsc, test:integration)
```

### Сценарий 2: /test-review команда
```
User: /test-review tests/integration/search.test.ts
  ↓
Main Claude:
1. Загружает router.md (size thresholds)
2. Читает test file (300 строк)
3. > 100 строк → делегирует qa agent
4. qa agent применяет 5 checks из standards.md
5. Выдает структурированный отчет
```

### Сценарий 3: Test failure после schema change
```
User: Тесты падают после изменения схемы
  ↓
Main Claude:
1. Загружает router.md (FAQ: schema change)
2. Загружает workflows.md (Test Failure Analysis)
3. Загружает standards.md (Schema/Cypher Risk check)
4. Если неочевидно → делегирует qa agent
5. Исправляет проблему
6. ✅ Вызывает reviewer + qa (MANDATORY)
```

---

## Принципы работы с роутером

1. **Ленивая загрузка** - не грузить все документы сразу, только нужное для задачи
2. **Delegation is mandatory** - reviewer + qa ВСЕГДА после написания тестов
3. **Size matters** - для `/test-review` > 100 строк → qa agent
4. **FAQ first** - проверь FAQ перед загрузкой документов

---

**Связь с другими роутерами**:
- **[cypher router](../cypher/router.md)** → для Direct Cypher Validation (standards.md → Direct Cypher Validation)
- **langgraph router** → для LangGraph integration tests (future)
