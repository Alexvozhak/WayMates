# Cold Start: Career Story Collection

> Multi-turn dialogue for collecting user's career history.

```mermaid
flowchart TD
    subgraph STORY ["1. Story Collection"]
        A([Start]) --> B[Collect Story]
        B --> C{Story complete?}
        C -->|No| B
        C -->|Yes| D[Plan Career Path]
    end

    subgraph EXTRACT ["2. Position Extraction"]
        D --> E[Extract Position]
        E --> F[Validate Data]
        F -->|Missing fields| G[Clarify]
        G --> E
        F -->|Valid| H[Show Position]
    end

    subgraph LOOP ["3. Build Trajectory"]
        H --> I{More positions?}
        I -->|Yes| E
        I -->|No| J[Final Review]
    end

    subgraph SAVE ["4. Save"]
        J --> K{Confirm?}
        K -->|Edit| H
        K -->|Save| L[Save to DB]
        L --> M([End])
    end

    C -->|Cancel| N([Cancel])
    K -->|Cancel| N

    style A fill:#e8f5e9
    style M fill:#e3f2fd
    style N fill:#ffebee
```

## Phases

| Phase | Description |
|-------|-------------|
| **Story Collection** | User tells their career story in free form |
| **Position Extraction** | AI extracts structured data (role, company, skills, dates) |
| **Build Trajectory** | Loop through all career positions |
| **Save** | Review and persist to database |

---
*Simplified view. Full graph: `npm run graph`*
