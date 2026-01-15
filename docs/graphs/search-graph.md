# Search: Career Path Discovery

> Find waymates (same goal) and pathfinders (achieved goal).

```mermaid
flowchart TD
    subgraph INIT ["1. Load Profile"]
        A([Start]) --> B{Has profile?}
        B -->|Yes| C[Load Profile]
        B -->|No| D[Quick Profile]
        D --> C
    end

    subgraph EXPLORE ["2. Explore Candidates"]
        C --> E{Has goal?}
        E -->|No| F[Explore All]
        F --> G[Show Candidates]
    end

    subgraph GOAL ["3. Set Career Goal"]
        G --> H{Set goal?}
        H -->|Yes| I[Extract Goal]
        I --> J[Validate Goal]
        J --> K[Save Goal]
    end

    subgraph SEARCH ["4. Targeted Search"]
        K --> L{Search mode?}
        E -->|Yes| L
        L -->|Waymates| M[Find Waymates]
        L -->|Pathfinders| N[Find Pathfinders]
        M --> O[Show Results]
        N --> O
    end

    subgraph ITERATE ["5. Refine"]
        O --> P{Action?}
        P -->|Filter| F
        P -->|New goal| I
        P -->|Done| Q([End])
    end

    H -->|Explore more| F
    P -->|Cancel| R([Cancel])

    style A fill:#e8f5e9
    style Q fill:#e3f2fd
    style R fill:#ffebee
```

## Search Modes

| Mode | Description |
|------|-------------|
| **Explore** | All candidates without goal filter |
| **Waymates** | People with the SAME career goal (not achieved yet) |
| **Pathfinders** | People who ACHIEVED your goal (proof of path) |

## Key Concepts

- **Goal** = Target position (role + skills + industry)
- **DTW Matching** = Trajectory similarity scoring
- **Filters** = Refine by skills, location, experience

---
*Simplified view. Full graph: `npm run graph`*
