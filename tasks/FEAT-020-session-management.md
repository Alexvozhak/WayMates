# FEAT-020: Session Management (Auth + Redis)

**Status**: READY_FOR_WORK
**Priority**: 🔴 P0
**Component**: Facade Auth
**ADR**: [ADR-029-auth-implementation](../../../docs/architecture/decisions/ADR-029-auth-implementation.md)

---

## Summary

Реализовать auth flow для Facade MCP Server: register/authenticate через unified `auth` tool, PostgreSQL для tokens, Redis для sessions, Single Active Session pattern.

---

## Acceptance Criteria

- [ ] AC1: auth({}) создает user в PostgreSQL и session в Redis
- [ ] AC2: auth({token}) валидирует token и создает session
- [ ] AC3: Single Active Session - новая auth убивает старую session
- [ ] AC4: Invalid token возвращает error code `invalid_token`
- [ ] AC5: Response содержит warning "Save this token" при register
- [ ] AC6: Существующие 13 tools работают без изменений
- [ ] AC7: lint + tsc + существующие тесты проходят

---

## Implementation Checklist

### Phase 1: Infrastructure

- [ ] `postgres.service.ts`: setupAuthTable() + user CRUD methods
- [ ] `env.ts`: AUTH_SESSION_TTL constant
- [ ] `result.ts`: invalid_token error code
- [ ] `errors.ts`: InvalidTokenError class

### Phase 2: Services

- [ ] `session-middleware.ts`: revokeAllUserSessions(), pointer key logic
- [ ] `auth.service.ts`: register(), authenticate()

### Phase 3: MCP Tool

- [ ] `schemas.ts`: authParamsSchema, tokenSchema
- [ ] `tools/auth.tool.ts`: unified auth tool
- [ ] `facade-mcp-server.ts`: registerAuthTool, authService в deps

### Phase 4: Tests (Q81 - location TBD)

- [ ] Register returns token + sessionId
- [ ] Authenticate returns sessionId
- [ ] SAS: новая auth revokes старую session
- [ ] Invalid token returns error

---

## Constraints

См. ADR-029 секция "Запреты"

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `mcp-server/auth.service.ts` | NEW |
| `mcp-server/tools/auth.tool.ts` | NEW |
| `mcp-server/schemas.ts` | ADD |
| `mcp-server/result.ts` | ADD |
| `mcp-server/tools/errors.ts` | ADD |
| `mcp-server/session-middleware.ts` | MODIFY |
| `infrastructure/postgres.service.ts` | MODIFY |
| `mcp-server/facade-mcp-server.ts` | MODIFY |
| `env.ts` | MODIFY |

---

## Open Questions

- Q81: Auth tests location (FAQ)

---

**Created**: 2025-12-02

---

## Implementation Notes

- Completed: 2025-12-02
- Deviations from plan: None
- Issues encountered:
  - Race condition in createWithSingleActiveSession fixed with Lua script
  - Token leak in error message fixed (no token in InvalidTokenError)
  - TTL sync: pointer + thread keys now updated in validate()
- Performance notes: Lua script ensures atomic session creation

## TODO

- [ ] Прогнать auth integration tests (требуется Redis + PostgreSQL):
  ```bash
  npm run test:integration -- --grep "Auth Tool"
  ```
