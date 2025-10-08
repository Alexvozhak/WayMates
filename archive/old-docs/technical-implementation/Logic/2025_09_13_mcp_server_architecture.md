# Архитектурный план MCP Ingest Server

Дата: 2025-09-13

## Обзор системы

MCP Ingest Server - это HTTP-сервер, реализующий протокол Model Context Protocol для унифицированного инжеста карьерных историй из различных источников в Neo4j базу данных WayMates.

### Ключевые принципы:
- **Единый шлюз**: все данные проходят через один pipeline
- **Flexible validation**: weak/strict режимы для разных источников
- **Идемпотентность**: безопасные повторные вызовы
- **Machine-readable errors**: структурированные ошибки для n8n

## 1. Sequence диаграмма: End-to-end поток данных

```mermaid
sequenceDiagram
    participant N8N as n8n Orchestrator
    participant TG as Telegram Bot
    participant EXT as External Sources
    participant MCP as MCP Server
    participant NEO as Neo4j DB
    participant AI as AI Service

    Note over N8N, AI: Scenario 1: Telegram User Story
    TG->>N8N: User story via Telegram
    N8N->>MCP: POST /ingest/validate?mode=strict
    MCP->>MCP: AJV validation + strict fields check
    alt Validation fails
        MCP->>N8N: 422 {missing_fields: [...]}
        N8N->>MCP: POST /ingest/clarify
        MCP->>N8N: {questions: [...]}
        N8N->>TG: Ask user for missing data
        TG->>N8N: User provides data
        N8N->>MCP: POST /ingest/validate?mode=strict
    end
    MCP->>N8N: 200 {ok: true}
    N8N->>MCP: POST /ingest/persist
    MCP->>MCP: Normalize (EN/USD/ISO)
    MCP->>NEO: CREATE Story/ContextSnapshot nodes
    NEO->>MCP: Success + IDs
    MCP->>AI: Generate embeddings (optional)
    MCP->>N8N: 200 {ids: {story_id, ...}}

    Note over N8N, AI: Scenario 2: External Source (Reddit/Dev.to)
    EXT->>N8N: Data via API/scraping
    N8N->>MCP: POST /ingest/validate?mode=weak
    MCP->>MCP: AJV validation + weak fields check
    alt Missing required source fields
        MCP->>N8N: 422 {missing_fields: ['source.system']}
        N8N->>N8N: Fix data mapping
        N8N->>MCP: POST /ingest/validate?mode=weak
    end
    MCP->>N8N: 200 {ok: true}
    N8N->>MCP: POST /ingest/persist
    MCP->>MCP: Check for duplicates
    alt Duplicate found
        MCP->>N8N: 409 {error: 'DUPLICATE'}
    else New story
        MCP->>MCP: Normalize data
        MCP->>NEO: CREATE nodes
        MCP->>N8N: 200 {ids: {...}}
    end
```

## 2. Компонентная диаграмма: Архитектура и интерфейсы

```mermaid
graph TB
    subgraph "n8n Orchestrator"
        TG[Telegram Bot Workflow]
        EXT[External Connectors]
        ORCH[Orchestration Logic]
    end

    subgraph "MCP Server (Fastify)"
        ROUTER[HTTP Router]
        TOOLS[MCP Tools Discovery]
        
        subgraph "Validation Layer"
            AJV[AJV Validator]
            TB[TypeBox Schemas]
            MODE[Mode Checker weak/strict]
        end
        
        subgraph "Business Logic"
            NORM[Normalization Engine]
            DEDUP[Deduplication Logic]
            CLARIFY[Clarify Generator]
        end
        
        subgraph "Persistence Layer"
            NEO4J[Neo4j Driver]
            EMBED[Embedding Service]
        end
        
        subgraph "Error Handling"
            ERR[Error Formatter]
            LOG[Request Logger]
        end
    end

    subgraph "Storage"
        NEO[(Neo4j Database)]
        AI_SVC[AI Service OpenAI]
    end

    TG --> ORCH
    EXT --> ORCH
    ORCH --> ROUTER

    ROUTER --> TOOLS
    ROUTER --> AJV
    AJV --> TB
    AJV --> MODE
    MODE --> CLARIFY
    MODE --> NORM
    NORM --> DEDUP
    DEDUP --> NEO4J
    NEO4J --> NEO
    NORM --> EMBED
    EMBED --> AI_SVC

    ROUTER --> ERR
    ROUTER --> LOG

    classDef external fill:#e1f5fe
    classDef validation fill:#f3e5f5
    classDef business fill:#e8f5e8
    classDef storage fill:#fff3e0
    
    class TG,EXT,ORCH external
    class AJV,TB,MODE validation
    class NORM,DEDUP,CLARIFY business
    class NEO,AI_SVC storage
```

## 3. Алгоритм обработки запроса: Блок-схема

```mermaid
flowchart TD
    START([HTTP Request]) --> ROUTE{Route?}
    
    ROUTE -->|GET /mcp/tools| TOOLS[Return MCP Tools List]
    ROUTE -->|POST /ingest/*| AUTH[Check Auth Token]
    ROUTE -->|Other| ERR404[404 Not Found]
    
    AUTH --> AUTHOK{Auth OK?}
    AUTHOK -->|No| ERR401[401 Unauthorized]
    AUTHOK -->|Yes| ENDPOINT{Endpoint?}
    
    ENDPOINT -->|/validate| VALIDATE
    ENDPOINT -->|/persist| PERSIST  
    ENDPOINT -->|/clarify| CLARIFY_FLOW
    
    subgraph "VALIDATE Flow"
        VALIDATE[Parse mode param] --> AJV_VAL[AJV Schema Check]
        AJV_VAL --> AJV_OK{Valid?}
        AJV_OK -->|No| ERR400[400 Schema Error]
        AJV_OK -->|Yes| MODE_CHECK[Check Required Fields by Mode]
        MODE_CHECK --> MODE_OK{All Required Present?}
        MODE_OK -->|No| ERR422[422 Missing Fields]
        MODE_OK -->|Yes| SUCCESS200[200 OK]
    end
    
    subgraph "PERSIST Flow" 
        PERSIST --> NORMALIZE[Normalize Data EN/USD/ISO]
        NORMALIZE --> GEN_IDS[Generate Stable IDs]
        GEN_IDS --> DEDUP_CHECK[Check for Duplicates]
        DEDUP_CHECK --> IS_DUP{Duplicate?}
        IS_DUP -->|Yes| ERR409[409 Conflict]
        IS_DUP -->|No| NEO_TX[Start Neo4j Transaction]
        NEO_TX --> CREATE_NODES[CREATE Story/Context/Resource Nodes]
        CREATE_NODES --> CREATE_RELS[CREATE Relationships]
        CREATE_RELS --> NEO_OK{Neo4j OK?}
        NEO_OK -->|No| ERR500[500 DB Error + Rollback]
        NEO_OK -->|Yes| COMMIT_TX[Commit Transaction]
        COMMIT_TX --> EMBEDDING[Generate Embeddings Optional]
        EMBEDDING --> SUCCESS201[201 Created + IDs]
    end
    
    subgraph "CLARIFY Flow"
        CLARIFY_FLOW --> ANALYZE[Analyze Missing Fields]
        ANALYZE --> GEN_QUESTIONS[Generate Human Questions]
        GEN_QUESTIONS --> RET_CLARIFY[Return Questions + Missing Fields]
    end
    
    TOOLS --> END([Response])
    ERR404 --> END
    ERR401 --> END  
    ERR400 --> END
    ERR422 --> END
    SUCCESS200 --> END
    ERR409 --> END
    ERR500 --> END
    SUCCESS201 --> END
    RET_CLARIFY --> END
    
    classDef success fill:#c8e6c9
    classDef error fill:#ffcdd2
    classDef process fill:#e1f5fe
    
    class SUCCESS200,SUCCESS201,TOOLS success
    class ERR404,ERR401,ERR400,ERR422,ERR409,ERR500 error
    class VALIDATE,PERSIST,CLARIFY_FLOW,NORMALIZE,CREATE_NODES process
```

## 4. Архитектура валидации: Детальная схема

```mermaid
flowchart LR
    subgraph "Input Payload"
        JSON[Raw JSON Payload]
    end
    
    subgraph "TypeBox Schema Layer"
        BASE_SCHEMA[Base Schema All Optional]
        TB_COMPILE[TypeBox → JSON Schema]
    end
    
    subgraph "AJV Validation"
        AJV_VALIDATE[AJV.validate]
        TYPE_CHECK[Type/Format Check]
    end
    
    subgraph "Mode-based Required Check"
        MODE_PARAM[mode=weak|strict]
        WEAK_RULES[Weak: source.* fields]
        STRICT_RULES[Strict: story.* fields]
        FIELD_CHECKER[Check Required Fields]
    end
    
    subgraph "Outputs"
        VALID[✓ Valid - Ready for Persist]
        MISSING[✗ Missing Fields List]
        INVALID[✗ Schema Violations]
    end
    
    JSON --> AJV_VALIDATE
    BASE_SCHEMA --> TB_COMPILE
    TB_COMPILE --> AJV_VALIDATE
    
    AJV_VALIDATE --> TYPE_CHECK
    TYPE_CHECK -->|Pass| FIELD_CHECKER
    TYPE_CHECK -->|Fail| INVALID
    
    MODE_PARAM --> WEAK_RULES
    MODE_PARAM --> STRICT_RULES
    WEAK_RULES --> FIELD_CHECKER
    STRICT_RULES --> FIELD_CHECKER
    
    FIELD_CHECKER -->|All Required Present| VALID
    FIELD_CHECKER -->|Missing Fields| MISSING
    
    classDef input fill:#e3f2fd
    classDef process fill:#f3e5f5  
    classDef success fill:#e8f5e8
    classDef error fill:#ffebee
    
    class JSON input
    class AJV_VALIDATE,FIELD_CHECKER process
    class VALID success
    class MISSING,INVALID error
```

## 5. Neo4j Data Model: Граф структуры

```mermaid
graph LR
    subgraph "Core Entities"
        CS1[ContextSnapshot<br/>snapshot_id<br/>signature_text<br/>language]
        CS2[ContextSnapshot<br/>snapshot_id<br/>signature_text<br/>language]
        STORY[Story<br/>story_id<br/>status<br/>period start/end<br/>hours_total<br/>rating_1_5]
        RESOURCE[CourseResource<br/>url_canonical<br/>title<br/>cost_total]
    end
    
    subgraph "Provenance"
        SOURCE[Source Metadata<br/>system<br/>channel<br/>url<br/>fetched_at]
    end
    
    subgraph "Relationships"
        STORY -.->|FROM| CS1
        STORY -.->|TO| CS2  
        STORY -.->|USED_RESOURCE| RESOURCE
        STORY -.->|HAS_SOURCE| SOURCE
    end
    
    subgraph "Indexes & Constraints"
        IDX1[UNIQUE: ContextSnapshot.snapshot_id]
        IDX2[UNIQUE: Story.story_id]
        IDX3[UNIQUE: CourseResource.url_canonical]
        IDX4[INDEX: Story.period.start_date]
        IDX5[INDEX: Story.status]
    end
    
    classDef entity fill:#e1f5fe
    classDef metadata fill:#fff3e0
    classDef constraint fill:#f3e5f5
    
    class CS1,CS2,STORY,RESOURCE entity
    class SOURCE metadata
    class IDX1,IDX2,IDX3,IDX4,IDX5 constraint
```

## Технические решения

### 1. Технологический стек
- **HTTP Server**: Fastify + встроенная AJV интеграция
- **Validation**: TypeBox + AJV v8
- **Database**: Neo4j официальный драйвер  
- **Embeddings**: OpenAI API (опционально)
- **Deployment**: Docker + GHCR + IaaS

### 2. Ключевые паттерны
- **Single Responsibility**: каждый endpoint выполняет одну задачу
- **Fail Fast**: валидация перед любой обработкой
- **Idempotency**: безопасные повторные вызовы persist
- **Machine Readable**: структурированные ошибки для автоматизации

### 3. Обработка ошибок
```typescript
interface MCPError {
  error: {
    code: 'VALIDATION_ERROR' | 'DUPLICATE' | 'DATABASE_ERROR';
    message: string;
    details?: any;
    missing_fields?: string[];
    request_id: string;
  }
}
```

### 4. Режимы валидации

| Mode | Use Case | Required Fields |
|------|----------|----------------|
| `weak` | External sources | `source.*`, `raw_text`, `lang` |
| `strict` | Telegram/Manual | `story.period.*`, `story.rating_1_5`, `story.*_snapshot_id` |

### 5. Нормализация

| Field | Transformation | Example |
|-------|---------------|---------|
| `signature_text` | → EN via AI | "Изучал React" → "Learned React" |
| `period` | → ISO dates + granularity | "2025-01" → `{start_date: "2025-01-01", granularity: "month"}` |
| `cost_total` | → USD conversion | "₽5000" → `{amount: 55.2, currency: "USD", original: "₽5000"}` |

## План разработки

### Phase 1: Core MCP Server (1-2 дня)
1. Fastify setup + TypeBox schemas
2. Basic endpoints `/mcp/tools`, `/ingest/validate`
3. AJV integration + mode checking
4. Unit tests

### Phase 2: Persistence Layer (1 день)  
1. Neo4j driver integration
2. `/ingest/persist` implementation
3. Normalization engine
4. Deduplication logic

### Phase 3: Error Handling & Polish (0.5 дня)
1. `/ingest/clarify` endpoint
2. Error formatting & logging
3. Integration tests
4. Docker deployment

### Phase 4: Production Ready (0.5 дня)
1. Security (auth, CORS, rate limiting)
2. Monitoring & health checks
3. Performance optimization
4. Documentation

**Total: ~4 дня разработки**
