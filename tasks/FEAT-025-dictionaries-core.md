# DictionariesManager Core (get/add/find)

**Priority**: 🔴 P0

Создать `DictionariesManager` в Core с 3 методами: getDictionaries() (verified terms, cache-friendly 24h), addTerm() (MERGE node, deduplication), findTerm() (fuzzy matching). Neo4j schema для Dictionary nodes. REST endpoints: GET /api/dictionaries, POST /api/dictionaries/term, POST /api/dictionaries/term/find.
