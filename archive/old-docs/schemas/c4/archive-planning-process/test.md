```mermaid
flowchart TD
    %% Этап 1 - синие узлы
    A1[1️⃣ AI предлагает описать контекст]
    A2[2️⃣ Формирование контекста]
    A3[3️⃣ Валидация контекста]
    A4{4️⃣ Контекст достаточен?}
    A5[5️⃣ Сохранение контекста]
    
    %% Этап 2A - оранжевые узлы
    C1[6️⃣ AI предлагает описать маршрут]
    C2[7️⃣ Формирование ответа]
    C3[8️⃣ Транскрибация и валидация]
    
    %% Этап 2B - зеленые узлы
    B1[1️⃣6️⃣ AI предлагает описать цель]
    B2[1️⃣7️⃣ Формирование ответа]
    B3[1️⃣8️⃣ Транскрибация и валидация]
    
    %% Связи
    A1 --> A2 --> A3 --> A4
    A4 -->|Да| A5
    A5 --> C1 --> C2 --> C3
    A5 --> B1 --> B2 --> B3
    
    %% Цветовые группы
    classDef stage1 fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef stage2A fill:#fff3e0,stroke:#f57c00,stroke-width:2px  
    classDef stage2B fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    
    class A1,A2,A3,A4,A5 stage1
    class C1,C2,C3 stage2A
    class B1,B2,B3 stage2B
    ```