# Linting & TypeScript Status

## Current State (2025-11-11)

### ESLint Results
```bash
npm run lint  # src/core src/facade src/shared
```

**Status**: ✅ 0 errors, 16 warnings

**Warnings Breakdown**:
| Rule | Count | Files | Priority |
|------|-------|-------|----------|
| `@typescript-eslint/no-non-null-assertion` | 16 | `src/core/*.ts`, `src/shared/*.ts` | P2 (acceptable) |

---

### TypeScript Results
```bash
npx tsc --noEmit
```

**Status**: ⚠️ 5 errors

**Errors Breakdown**:
| Type | Count | Files | Priority |
|------|-------|-------|----------|
| Trail snake_case vs camelCase | 5 | `src/core/story-manager.ts`, `src/schemas-zod.ts` | P1 |

**Note**: Tests work despite errors (Zod runtime validation).

---

## Historical Trends

| Date | ESLint Errors | ESLint Warnings | TypeScript Errors | Notes |
|------|---------------|-----------------|-------------------|-------|
| 2025-11-11 | 0 | 16 | 5 | Current state |
| 2025-11-10 | 0 | 16 | 5 | Strict config enforced |
| 2025-11-08 | 0 | 0 | 0 | camelCase migration |
| 2025-11-07 | 2 | 18 | 3 | TargetCriteria refactoring |

---

## Test-Specific Rules

См. `eslint.config.mjs` для актуальной конфигурации:

```javascript
{
  files: ['tests/**/*.ts', 'vitest.config.ts'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    'max-lines-per-function': 'off',
    'import-x/no-default-export': 'off',
  },
}
```

**Rationale**: Test readability > strict typing rules.

---

## Planned Fixes

### P1 (High Priority)
- [ ] Fix Trail camelCase consistency (TypeScript errors)

### P2 (Medium Priority)
- [ ] Audit non-null assertions (можно заменить на optional chaining?)

---

*Last updated: 2025-11-11*
*Update this file after every lint/tsc run*
