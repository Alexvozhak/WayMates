# 🏗️ WayMates Data-Driven Career Intelligence Architecture (ОБНОВЛЕНО)

## 📊 Обзор архитектуры

### **Обновленный технологический стек**

```mermaid
graph TB
    subgraph "👤 Пользователи"
        User[Пользователь<br/>Telegram Bot Interface]
    end
    
    subgraph "🤖 AI Processing Layer"
        LightRAG[LightRAG HTTP Service<br/>Natural Language Processing]
        OpenAI[OpenAI API<br/>GPT-4, Embeddings]
    end
    
    subgraph "🏗️ Application Layer"
        NestJS[NestJS Application<br/>TypeScript + DI Container]
        TelegramBot[Telegram Bot API<br/>Natural Language Interface]
    end
    
    subgraph "💾 Data Storage Layer"
        PostgreSQL[PostgreSQL 15+<br/>OLTP + Graph + Vectors]
        ClickHouse[ClickHouse<br/>Analytics + Time Series]
        Redis[Redis<br/>Cache + Sessions]
    end
    
    subgraph "📊 Career Intelligence Features"
        SkillSaturation[Skill Saturation Detection<br/>Horizontal Growth Analysis]
        VerticalGrowth[Vertical Growth Assessment<br/>Leadership Readiness]
        CompanyTypes[Company Type Intelligence<br/>Promotion Patterns]
        TimePredictions[Mathematical Time Predictions<br/>UserFactor × TempoBucket]
    end
    
    subgraph "📚 Data Sources"
        ESCO[ESCO EU Skills Framework<br/>13,000+ стандартизированных навыков]
        ExpertData[Expert Career Patterns<br/>Валидированные карьерные паттерны]
        UserData[User Behavior Data<br/>Study sessions + Career transitions]
    end
    
    %% User interactions
    User --> TelegramBot
    TelegramBot --> NestJS
    
    %% AI Processing
    NestJS --> LightRAG
    NestJS --> OpenAI
    LightRAG --> PostgreSQL
    OpenAI --> NestJS
    
    %% Data Storage
    NestJS --> PostgreSQL
    NestJS --> ClickHouse
    NestJS --> Redis
    
    %% Career Intelligence
    NestJS --> SkillSaturation
    NestJS --> VerticalGrowth
    NestJS --> CompanyTypes
    NestJS --> TimePredictions
    
    %% Data Sources
    ESCO --> PostgreSQL
    ExpertData --> ClickHouse
    UserData --> ClickHouse
    
    %% Career Intelligence connections
    SkillSaturation --> ClickHouse
    VerticalGrowth --> ClickHouse
    CompanyTypes --> ClickHouse
    TimePredictions --> ClickHouse
    
    %% Styling
    classDef userLayer fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef aiLayer fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef appLayer fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef dataLayer fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef intelligenceLayer fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef sourceLayer fill:#f9f9f9,stroke:#666666,stroke-width:2px
    
    class User userLayer
    class LightRAG,OpenAI aiLayer
    class NestJS,TelegramBot appLayer
    class PostgreSQL,ClickHouse,Redis dataLayer
    class SkillSaturation,VerticalGrowth,CompanyTypes,TimePredictions intelligenceLayer
    class ESCO,ExpertData,UserData sourceLayer
```

## 🎯 Ключевые особенности архитектуры

### **1. Data-Driven Career Intelligence**
- **Skill Saturation Detection**: Алгоритм определения plateau в горизонтальном росте
- **Vertical Growth Assessment**: 4-факторный анализ готовности к leadership
- **Company Type Intelligence**: Анализ promotion patterns по типам компаний
- **Mathematical Time Predictions**: UserFactor × TempoBucket × Paradigm algorithms

### **2. Natural Language Processing**
- **LightRAG**: HTTP API для обработки естественного языка
- **OpenAI GPT-4**: Анализ карьерных данных и генерация рекомендаций
- **Telegram Bot**: Интерфейс для natural language interaction

### **3. Hybrid Database Architecture**
- **PostgreSQL**: OLTP + Graph + Vectors для структурированных данных
- **ClickHouse**: OLAP Analytics для career intelligence
- **Redis**: Кэш и сессии для производительности

### **4. ESCO EU Skills Integration**
- **13,000+ стандартизированных навыков** с иерархией
- **BGE-m3 embeddings** для семантического поиска
- **EU competency standards** для time predictions

## 🔄 Потоки данных

### **Создание пользовательского профиля**
```
User → Telegram Bot → NestJS → PostgreSQL → Skill Saturation Analysis → ClickHouse
```

### **Поиск карьерных путей**
```
User Query → LightRAG → PostgreSQL Graph → ClickHouse Analytics → OpenAI Analysis → Recommendations
```

### **Career Intelligence Analysis**
```
User Profile → Skill Saturation Detection → Vertical Growth Assessment → Company Type Analysis → Action Plan
```

### **Обновление career intelligence**
```
New User Data → ClickHouse → Career Intelligence Algorithms → Updated Recommendations → Cache Invalidation
```

## 📊 Уникальные возможности WayMates

### **1. Теория убывающей отдачи горизонтального роста**
- Анализ skill saturation для определения момента переключения стратегии
- Математические расчеты ROI от изучения новых навыков
- Рекомендации по переходу от горизонтального к вертикальному росту

### **2. Теория трех осей карьерного роста**
- **Ширина**: Рост по доменной области в ширину
- **Глубина**: Рост по доменной области в глубину
- **Вертикаль**: Вертикальный рост (управление людьми)

### **3. Proven Responsibility Assessment**
- Results-based анализ management experience
- Оценка готовности к leadership roles
- Конкретные метрики для принятия решений

### **4. Mathematical Time Predictions**
- ESCO EU standards + статистическая валидация
- Персонализированные прогнозы времени обучения
- Confidence scores для каждого прогноза

## 🚀 Готовность к реализации

### **✅ Технические решения валидированы**
- **PostgreSQL + Apache AGE + pgvector**: Production-ready multi-model database
- **ClickHouse**: Optimal для career analytics и promotion intelligence
- **LightRAG HTTP API**: Simplified TypeScript-only integration
- **OpenAI API**: Качество русского языка для MVP критично
- **Telegram Bot API**: Natural language interface

### **🎯 Уникальная ценность WayMates**
- **EU standards + expert career intelligence** → эволюция к data-driven
- **Skill Dependencies Analysis** — какие prerequisites критичны для success rate
- **Company Type Intelligence** — по типам компаний (Series A/B, Enterprise)
- **Vertical growth probability** calculations из real promotion data
- **Experience-Based Readiness** — что можно изучить vs что требует опыта
- **Statistical Evidence** — каждая рекомендация backed минимум 50+ cases

### **📊 Impact Assessment**
- **Timeline**: 7-8 недель до production-ready системы
- **Value Proposition**: 300% увеличение — unique data-driven approach
- **Risk**: Medium — все технологии validated, proven architecture
- **MVP Focus**: Career progression intelligence вместо generic learning advice

