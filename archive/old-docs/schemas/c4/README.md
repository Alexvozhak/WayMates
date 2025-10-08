# 🏗️ WayMates C4 Architecture Diagrams

## 📋 Структура C4 диаграмм

### **Level 1: System Context**
[`01-context.md`](./01-context.md) - Общий контекст системы WayMates
- Внешние пользователи (путешественники, туристы)
- Внешние системы (OpenAI API, Neo4j Cloud, Pinecone)
- Основные взаимодействия

### **Level 2: Container Diagram**
[`02-containers.md`](./02-containers.md) - Архитектура контейнеров
- Web Application (React/Next.js)
- API Gateway
- Core API (NestJS)
- Databases (Neo4j, Pinecone, Redis)

### **Level 3: Component Diagram**
[`03-components.md`](./03-components.md) - Компоненты внутри Core API
- Business Services (StoryService, QueryService, ModerationService)
- Technical Components (OpenAI, Neo4j, Pinecone integrations)
- Data Flow между компонентами

### **Level 4: Code Level**
[`04-code.md`](./04-code.md) - Детали реализации
- NestJS модули и их структура
- Dependency Injection схема
- Ключевые интерфейсы и классы

## 🎯 Принципы C4 для WayMates

### **Фокус на бизнес-ценности**
- Показываем, как система решает задачи путешественников
- Подчеркиваем уникальность NL2Cypher подхода
- Демонстрируем интеграцию AI и графовых баз данных

### **Технологические решения**
- **Frontend**: React/Next.js веб-приложение
- **Backend**: NestJS API с модульной архитектурой
- **AI/ML**: OpenAI GPT-4, Claude Sonnet, Whisper.cpp
- **Storage**: Neo4j (граф), Pinecone (векторы), Redis (кэш)
- **Infrastructure**: Cloud deployment (AWS/Azure)

### **Ключевые потоки данных**
1. **Story Creation**: Пользователь → Web App → API → LLM → Neo4j
2. **Query Processing**: Пользователь → Web App → API → NL2Cypher → Neo4j
3. **Content Moderation**: Контент → API → LLM Validator → Результат

---

*C4 диаграммы создаются в соответствии с [C4 model](https://c4model.com/) от Simon Brown*

