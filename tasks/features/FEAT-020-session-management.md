# Session Management (Redis validation, auth middleware)

**Priority**: 🔴 P0

Реализовать session validation middleware для всех Facade MCP tools: Redis GET session:{session_id} → userId, TTL 1h, register/authenticate endpoints, Single Active Session policy.
