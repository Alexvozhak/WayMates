Подходы к работе с историями (graph rag patterns)
├── Ingest & Валидация
│   ├── NLU (правила + LLM)
│   ├── JSON Schema валидация (TypeBox + AJV, унифицировано для NLU и NL→Cypher)
│   └── KAG-judge (правила + LLM + уточнения)
│
├── Модерация
│   ├── Human-in-the-loop (GitHub PR review с артефактами story.md/json/judge.json)
│   └── User confirm (Telegram подтверждение/исправление)
│
├── Хранение
│   ├── Neo4j Graph DB (узлы + связи; истории как вершины)
│   └── Neo4j Vector Index (BGE-m3; HNSW ANN)
│
├── Retrieval
│   ├── Vector Similarity Search (ANN, косинусное сходство)
│   ├── Graph Traversal (Cypher-expansion)
│   └── Гибрид: GraphRAG (Vector + Graph traversal)
│
├── NL→Cypher слой
│   ├── Интерфейс `QueryToCypher` (единый контракт)
│   ├── CustomNeo4jExamples (дефолт: LLM JSON-mode → AJV → Guards → StaticChecks → EXPLAIN → READ)
│   ├── LangChainAdapter (опция через конфиг)
│   └── LlamaIndexAdapter (опция через конфиг)
│
└── Адаптивный поиск маршрутов
    ├── Match по контексту пользователя (state/goals/constraints)
    ├── Выбор verified маршрутов (проверенные истории + Match-score)
    ├── Expectation vs Reality (идеальный план vs фактический прогресс)
    └── Risk/Alternative Path (Crossroads, Failure Feed)
