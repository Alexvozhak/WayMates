# AI-First Career Intelligence Platform Architecture

## 🎯 **Концепция: AI-First Data-Driven Career Intelligence**

**Основная идея:** Единый Main AI Agent получает пользовательский запрос и самостоятельно решает, какие данные ему нужны для ответа. Он использует LightRAG и MCP как **инструменты извлечения данных**, а всю аналитику и генерацию ответов выполняет сам.

### **Ключевые принципы:**
1. **AI-центричность** — все решения принимает Main AI
2. **Данные как сервисы** — LightRAG и MCP только извлекают данные
3. **Единая точка анализа** — вся логика в одном AI
4. **Максимальная гибкость** — AI может отвечать на любые вопросы

## 🏗️ **Архитектурная диаграмма**

```mermaid
graph TD
    User[👤 Пользователь] --> TelegramBot[📱 Telegram Bot]
    TelegramBot --> MainAI[🧠 Main AI Agent]
    
    MainAI --> QueryAnalysis[🔍 Query Analysis]
    QueryAnalysis --> DataStrategy[📋 Data Extraction Strategy]
    
    DataStrategy --> NeedsProfilesOrGraph{👥 Профили или граф?}
    DataStrategy --> NeedsAnalytics{📊 Аналитика?}
    
    NeedsProfilesOrGraph -->|ДА| LightRAGExtractor[🔧 LightRAG Data Extractor]
    NeedsAnalytics -->|ДА| MCPExtractor[🔧 MCP Data Extractor]
    
    LightRAGExtractor --> PostgreSQLVectors[(🗄️ PostgreSQL + Vectors)]
    LightRAGExtractor --> ApacheAGEGraph[(🕸️ Apache AGE Graph)]
    
    MCPExtractor --> ClickHouse[(📈 ClickHouse Analytics)]
    
    PostgreSQLVectors --> RawData1[📄 Raw Profile/Vector Data]
    ApacheAGEGraph --> RawData2[🔗 Raw Graph Data]
    ClickHouse --> RawData3[📊 Raw Analytics Data]
    
    RawData1 --> MainAI
    RawData2 --> MainAI
    RawData3 --> MainAI
    
    MainAI --> DataIntegration[🔄 Data Integration & Analysis]
    DataIntegration --> ResponseGeneration[✨ Response Generation]
    
    ResponseGeneration --> PersonalizedAnswer[🎯 Персональный ответ]
    PersonalizedAnswer --> TelegramBot
    TelegramBot --> User
    
    %% Styling
    style MainAI fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    style LightRAGExtractor fill:#e1f5fe,stroke:#0288d1,stroke-width:3px
    style MCPExtractor fill:#e1f5fe,stroke:#0288d1,stroke-width:2px
    style DataIntegration fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    style PersonalizedAnswer fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    
    style PostgreSQLVectors fill:#e8f5e8,stroke:#4caf50
    style ApacheAGEGraph fill:#f3e5f5,stroke:#9c27b0
    style ClickHouse fill:#fff3e0,stroke:#ff9800
```

## 🔄 **Поток обработки запросов**

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant T as 📱 Telegram Bot
    participant AI as 🧠 Main AI Agent
    participant LR as 🔧 LightRAG Extractor
    participant MCP as 🔧 MCP Extractor
    participant PG as 🗄️ PostgreSQL+Vectors
    participant AG as 🕸️ Apache AGE Graph
    participant CH as 📈 ClickHouse
    
    U->>T: "Хочу изучить React на основе успешных профилей"
    T->>AI: User Query
    
    AI->>AI: 🔍 Analyze Query
    Note over AI: Нужны профили + граф зависимостей
    
    AI->>LR: Extract profiles + skill dependencies
    LR->>PG: Search similar profiles
    LR->>AG: Get skill dependency graph
    PG-->>LR: Profile data
    AG-->>LR: Graph data
    LR-->>AI: Combined profile + graph data
    
    AI->>AI: 🔄 Integrate & analyze all data
    AI->>AI: ✨ Generate personalized response
    
    AI-->>T: 🎯 Learning path + successful examples
    T-->>U: Персональный план с примерами
```

## 🧠 **Main AI Agent Architecture**

### **Центральный интеллект системы:**
```typescript
class MainAIAgent {
  async processUserQuery(query: string): Promise<string> {
    // 1. Анализ запроса пользователя
    const queryAnalysis = await this.analyzeQuery(query);
    
    // 2. Планирование извлечения данных
    const dataStrategy = await this.planDataExtraction(queryAnalysis);
    
    // 3. Параллельное извлечение данных
    const extractedData = await this.extractData(dataStrategy);
    
    // 4. Интеграция и анализ всех данных
    const analysis = await this.integrateAndAnalyze(extractedData, query);
    
    // 5. Генерация персонализированного ответа
    return await this.generateResponse(analysis, query);
  }
}
```

### **Логика принятия решений:**
- **Профили или графы** → LightRAG Data Extractor
- **Аналитика и статистика** → MCP Data Extractor  
- **Комплексные запросы** → Оба экстрактора + AI анализ

## 🔧 **Data Extraction Tools**

### **LightRAG Data Extractor (универсальный):**
```typescript
class LightRAGDataExtractor {
  async extractData(query: string, dataType: 'profiles' | 'graph' | 'both') {
    switch (dataType) {
      case 'profiles':
        return await this.extractFromPostgreSQL(query); // + Vectors
      case 'graph':
        return await this.extractFromApacheAGE(query);  // Graph traversal
      case 'both':
        return await this.extractBoth(query);           // Parallel extraction
    }
  }
}
```

### **MCP Data Extractor (аналитика):**
```typescript
class MCPDataExtractor {
  async extractAnalytics(query: string) {
    // MCP AI генерирует SQL + выполняет в ClickHouse
    return await this.mcp.analyze(query);
  }
}
```

## ⚡ **Преимущества AI-First архитектуры**

### **✅ Единая точка интеллекта:**
- Все решения принимает один AI
- Консистентные ответы
- Единая логика обработки

### **✅ Максимальная гибкость:**
- AI может отвечать на любые вопросы
- Автоматический выбор источников данных
- Адаптация к новым типам запросов

### **✅ Оптимальное использование ресурсов:**
- Параллельное извлечение данных
- Использование только нужных источников
- Кэширование результатов

### **✅ Масштабируемость:**
- Легко добавлять новые источники данных
- Простое расширение функциональности
- Горизонтальное масштабирование

## 🎯 **Типы запросов и обработка**

### **Только LightRAG Data Extractor:**
- "Покажи похожих людей, которые стали Senior Developer"
- "Какие навыки изучали успешные Tech Lead'ы?"
- "Найди профили с опытом в финтехе"

### **Только MCP Data Extractor:**
- "Покажи статистику изучения React за последний год"
- "Какая средняя зарплата Senior Developer'ов?"
- "Создай дашборд по эффективности обучения"

### **Оба экстрактора + AI анализ:**
- "Сколько времени нужно для изучения React?"
- "Какие компании лучше для карьерного роста?"
- "Стоит ли мне изучать Vue.js или React?"

## 🚀 **Итоговое видение**

**WayMates как AI-First Career Intelligence Platform:**

1. **Единый AI Agent** — принимает все решения и выполняет всю аналитику
2. **Инструменты извлечения данных** — LightRAG, MCP как сервисы
3. **Максимальная гибкость** — может отвечать на любые карьерные вопросы
4. **Персонализированные ответы** — на основе полного анализа всех доступных данных

**Результат:** Интеллектуальная система, которая может дать экспертный совет по любому вопросу карьерного развития! 🎯



