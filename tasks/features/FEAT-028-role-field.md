# FEAT-028: Add Role Field (Profession/Stack)

**Статус**: PENDING
**Приоритет**: 🔴 P0 (блокер для корректного matching разных профессий)
**Создано**: 2025-12-19

---

## Проблема

Текущая модель НЕ различает профессию (developer vs tester vs devops):

```
position = грейд + власть (junior, middle, senior, tech lead, manager)
domains = техническая область (backend, frontend, mobile, data, ...)
```

**Проблемные кейсы:**
- "Junior QA" → position: junior, domains: [qa] — но QA это профессия, не domain
- "Senior DevOps" → непонятно это role или domain
- "Backend Developer" vs "Backend Tester" — неразличимы

**Следствие:** Нельзя найти pathfinders из тестировщиков в разработчики (или наоборот).

---

## Предлагаемое решение

Добавить поле `role` (профессия/технический стек):

```typescript
role: "developer" | "tester" | "devops" | "sysadmin" | "analyst"
```

### Финальная модель

| Поле | Что это | Примеры |
|------|---------|---------|
| **role** | Профессия/стек | developer, tester, devops, sysadmin, analyst |
| **position** | Грейд + власть | junior, middle, senior, tech lead, engineering manager |
| **domains** | Техническая область | backend, frontend, mobile, data, qa, infra |

### Примеры маппинга

| User говорит | role | position | domains |
|--------------|------|----------|---------|
| "Junior Frontend Developer" | developer | junior | [frontend] |
| "Tech Lead Backend команды" | developer | tech lead | [backend] |
| "Senior QA" | tester | senior | [qa] |
| "Middle DevOps Engineer" | devops | middle | [infra] |
| "Engineering Manager фронтенда" | developer | engineering manager | [frontend] |

---

## Scope изменений (оценка)

- [ ] Schema: добавить `role` field в UserContext, AdhocContext, TargetContext
- [ ] Neo4j: migration script для существующих данных (default: "developer")
- [ ] Prompts: обновить extraction prompts (cold-start, adhoc, goal)
- [ ] Fixtures: добавить role в U1-U18
- [ ] Search: учитывать role в matching/scoring
- [ ] Tests: обновить тесты

**Оценка:** 2-3 часа

---

## Не в scope

- Переименование position → seniority (отдельная задача если нужно)
- Добавление новых roles (pm, designer, etc.) — расширим позже

---

## Связанные документы

- `sessions/2025-12-19-test-coverage-analysis.md` — обсуждение архитектуры
- `src/shared/schemas.ts` — текущая схема
