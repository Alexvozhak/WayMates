# 📚 WayMates Glossary

## 🏗️ Architectural Components

### **Core Business Services (MVP Architecture)**
- **AuthorRankingService** - сервис ранжирования авторов с MCDM поддержкой
- **InteractiveCastingService** - сервис интерактивного "кастинга" авторов
- **AutomatedCastingService** - сервис автоматического подбора авторов  
- **ExpandSearchService** - сервис расширяющего поиска (узко → широко)
- **NarrowSearchService** - сервис сужающего поиска (широко → узко)

### **MCDM Services (Multi-Criteria Decision Making)**
- **TopsisService** - TOPSIS ранжирование (близость к идеальному решению)
- **VikorService** - VIKOR ранжирование (компромиссное решение)
- **PrometheeService** - PROMETHEE ранжирование (парные сравнения)
- **SimpleWeightedService** - простое взвешенное ранжирование

### **Service-based Terminology (финализировано)**
- **Interactive Casting Service** - интерактивный процесс "примерки" контекстов авторов
- **Automated Casting Service** - автоматический процесс подбора авторов
- **Expand Search Service** - поиск от узких к широким критериям
- **Narrow Search Service** - поиск от широких к узким критериям

### **Interface Nodes (Интерфейсные узлы)**
- **ILLMNode** - узел языковых моделей (LLM = Large Language Model)
- **IStorageNode** - узел хранения данных
- **IValidatorNode** - узел валидации
- **IRetrievalNode** - узел поиска и извлечения
- **IQueryProcessorNode** - узел обработки запросов

### **Data Types (Типы данных)**
- **StoryInput** - входные данные для создания истории (текст, метаданные, контекст)
- **Story** - история путешествия с полной информацией
- **QueryRequest** - запрос пользователя (текст, контекст, параметры)
- **QueryResult** - результат обработки запроса
- **ValidationResult** - результат валидации

### **Implementation Providers (Провайдеры реализации)**
- **OpenAIProvider** - провайдер OpenAI API
- **SonnetProvider** - провайдер Anthropic Claude
- **Neo4jProvider** - провайдер Neo4j базы данных
- **VectorProvider** - провайдер векторных индексов

## 📊 MVP Technology Stack

### **Finalized Technologies**
- **Backend**: NestJS + TypeScript + DI Container
- **Database**: Neo4j (graph + vectors)
- **Ranking**: mcdm-js library (TOPSIS, VIKOR, PROMETHEE)
- **AI Workflows**: LangGraph 
- **Interface**: Telegram Bot API
- **Architecture**: Service-based with DI for method switching

### **Key Libraries**
- **mcdm-js** - JavaScript MCDM library для научного ранжирования
- **@nestjs/common** - DI decorators и архитектурные паттерны
- **neo4j-driver** - драйвер для Neo4j database
- **telegraf** - Telegram Bot API framework
