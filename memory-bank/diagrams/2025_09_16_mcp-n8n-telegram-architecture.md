# WayMates MCP + n8n + Telegram Architecture

> **Статус:** Эта интеграция — после минимального плана.

## Mermaid Block Diagram

```mermaid
graph TB
    subgraph "User Layer"
        U[👤 User]
    end
    
    subgraph "Communication Layer"
        TG[📱 Telegram Bot]
        WEBHOOK[🔗 Telegram Webhook]
    end
    
    subgraph "Orchestration Layer"
        N8N[⚙️ n8n Workflows]
        WF1[📝 Message Parser]
        WF2[🔄 Logic Router]
        WF3[📊 Response Formatter]
    end
    
    subgraph "MCP Server Layer"
        MCP[🔌 WayMates MCP Server]
        API1[📋 /mcp/tools]
        API2[✅ /ingest/validate]
        API3[💾 /ingest/persist]
        API4[❓ /ingest/clarify]
    end
    
    subgraph "Data Layer"
        NEO4J[🕸️ Neo4j Graph DB]
        POSTGRES[🐘 PostgreSQL]
        VECTORS[🧠 Vector Store]
    end
    
    subgraph "AI Processing"
        AI[🤖 AI Parser]
        STRUCT[📋 Structure Extractor]
        VALID[✅ Data Validator]
    end
    
    %% User interactions
    U -->|Message| TG
    TG -->|Webhook| WEBHOOK
    WEBHOOK -->|Trigger| N8N
    
    %% n8n workflow
    N8N -->|Parse| WF1
    WF1 -->|Route| WF2
    WF2 -->|Call MCP| MCP
    
    %% MCP API calls
    MCP -->|Tools Discovery| API1
    MCP -->|Validate Data| API2
    MCP -->|Persist Data| API3
    MCP -->|Clarify Missing| API4
    
    %% AI processing
    MCP -->|Process| AI
    AI -->|Extract| STRUCT
    STRUCT -->|Validate| VALID
    VALID -->|Return| MCP
    
    %% Data storage
    MCP -->|Store Graph| NEO4J
    MCP -->|Store Relational| POSTGRES
    MCP -->|Store Vectors| VECTORS
    
    %% Response flow
    MCP -->|JSON Response| WF2
    WF2 -->|Format| WF3
    WF3 -->|Send| TG
    TG -->|Reply| U
    
    %% Data queries
    N8N -.->|Query Data| MCP
    MCP -.->|Read| NEO4J
    MCP -.->|Read| POSTGRES
    MCP -.->|Search| VECTORS
    
    %% Styling
    classDef userLayer fill:#e1f5fe
    classDef commLayer fill:#f3e5f5
    classDef orchestrationLayer fill:#e8f5e8
    classDef mcpLayer fill:#fff3e0
    classDef dataLayer fill:#fce4ec
    classDef aiLayer fill:#f1f8e9
    
    class U userLayer
    class TG,WEBHOOK commLayer
    class N8N,WF1,WF2,WF3 orchestrationLayer
    class MCP,API1,API2,API3,API4 mcpLayer
    class NEO4J,POSTGRES,VECTORS dataLayer
    class AI,STRUCT,VALID aiLayer
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant TG as Telegram
    participant N8N as n8n
    participant MCP as WayMates MCP
    participant AI as AI Parser
    participant DB as Database
    
    U->>TG: Send message
    TG->>N8N: Webhook trigger
    N8N->>MCP: POST /ingest/validate
    MCP->>AI: Process raw text
    AI->>AI: Extract contexts, trails, goals
    AI->>MCP: Structured JSON
    MCP->>MCP: Validate structure
    MCP->>N8N: Validation result
    
    alt Data incomplete
        N8N->>MCP: POST /ingest/clarify
        MCP->>N8N: Questions for user
        N8N->>TG: Send clarification
        TG->>U: Ask for details
        U->>TG: Provide details
        TG->>N8N: Updated data
    end
    
    N8N->>MCP: POST /ingest/persist
    MCP->>DB: Store in Neo4j/Postgres
    MCP->>N8N: Success response
    N8N->>TG: Send confirmation
    TG->>U: Show result
```

## n8n Workflow Configuration

```mermaid
graph LR
    subgraph "n8n Workflow"
        T1[Telegram Trigger]
        T2[Parse Message]
        T3{Message Type?}
        T4[Validate Data]
        T5[Clarify Missing]
        T6[Persist Data]
        T7[Format Response]
        T8[Send to Telegram]
        
        T1 --> T2
        T2 --> T3
        T3 -->|New Story| T4
        T3 -->|Query| T7
        T4 -->|Valid| T6
        T4 -->|Invalid| T5
        T5 --> T4
        T6 --> T7
        T7 --> T8
    end
```

## Key Integration Points

1. **Telegram → n8n**: Webhook-based message processing
2. **n8n → MCP**: HTTP API calls to WayMates MCP server
3. **MCP → AI**: Text processing and structure extraction
4. **MCP → Database**: Data persistence in graph and relational stores
5. **n8n → Telegram**: Formatted responses back to user

## Benefits of This Architecture

- **Decoupled**: Each component has single responsibility
- **Scalable**: n8n handles orchestration, MCP handles data processing
- **Flexible**: Easy to add new integrations via n8n nodes
- **Maintainable**: Clear separation of concerns
- **Extensible**: Can add more data sources and AI providers



