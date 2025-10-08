# 🔍 Детальный технический анализ архитектуры

## 📝 2. Финальная терминология сервисов

### **Исправленные названия:**
1. **Story Matching Service** (поиск и сопоставление историй авторов)
2. **Route Building Service** (построение персонального маршрута)  
3. **Progress Monitoring Service** (мониторинг выполнения прогресса)

**Логика:** Matching → Building → Monitoring - четкая последовательность действий.

## 🔧 3. Сочетаемые пары терминологии

### **Проблема:** Нужны пары где одно слово совпадает

#### **Текущие термины:**
- **Interactive Review** + **Progressive Narrowing**
- Нет общих слов, сложно запоминать

#### **Варианты сочетаемых пар:**

##### **Вариант A: "Interactive" + "Progressive"**
- **Interactive Dialog** + **Progressive Filtering**
- **Interactive Review** + **Progressive Search** 
- **Interactive Discovery** + **Progressive Narrowing**

##### **Вариант B: "Guided" подход**  
- **Guided Workflow** + **Guided Filtering**
- **Guided Journey** + **Guided Search**
- **Guided Discovery** + **Guided Narrowing**

##### **Вариант C: "Smart" подход**
- **Smart Dialog** + **Smart Filtering** 
- **Smart Review** + **Smart Search**
- **Smart Discovery** + **Smart Narrowing**

**Рекомендация: Вариант B "Guided"** - наиболее понятно и создает ощущение персонального гида.

### **Финальная терминология MVP:**
- **Workflow Approach**: **Guided Discovery** (пошаговое изучение с гидом-AI)
- **Search Strategy**: **Guided Narrowing** (постепенное сужение под руководством)

### **Архитектура DI:**
```typescript
@Module({
  providers: [
    StoryMatchingService,
    {
      provide: 'WORKFLOW_STRATEGY',
      useClass: GuidedDiscoveryWorkflow, // MVP
    },
    {
      provide: 'SEARCH_STRATEGY', 
      useClass: GuidedNarrowingSearch, // MVP
    },
    // Заложенность на будущее
    AIPreparationWorkflow,    // для v2.0
    StrictFilteringSearch,    // для power users
    ExpandSearchStrategy,     // для rare cases
  ],
})
```

## 🔬 5. Детальный анализ научных областей

### **1. Interactive Information Retrieval (IIR)**

#### **🎓 Научный контекст:**
- **Основатель**: Nicholas Belkin (Rutgers University, 1980s)
- **Развитие**: Peter Ingwersen, Tefko Saracevic, Ryen White (Microsoft Research)
- **Ключевые работы**: "Interactive Information Seeking, Behaviour and Retrieval" (2011)

#### **🏢 Где применяется:**
- **Google Search**: Query suggestions, "Did you mean", refinement
- **Amazon**: Product filtering, progressive search refinement
- **Spotify**: Music discovery through iterative feedback
- **Academic databases**: PubMed, JSTOR с guided search

#### **🛠️ Конкретные библиотеки:**

##### **Elasticsearch (Apache 2.0 лицензия)**
```bash
npm install @elastic/elasticsearch
```
**Что дает:**
- Готовые query suggestions
- Faceted search (фильтрация по категориям)
- Relevance feedback loops
- Auto-complete с контекстом

**Практическое применение в проекте:**
```javascript
// Вместо написания сложной логики поиска
const searchResponse = await esClient.search({
  query: {
    bool: {
      should: [
        { match: { skills: userContext.skills }},
        { match: { story: userQuery }}
      ]
    }
  },
  aggs: {
    // Автоматические фасеты для constraints
    budget_ranges: { range: { field: 'budget', ranges: [/*...*/] }},
    timeline_ranges: { range: { field: 'timeline_months', ranges: [/*...*/] }}
  }
});

// Получаем готовые варианты сужения поиска
const constraints_suggestions = searchResponse.aggregations;
```

**Что НЕ придется писать:**
- ❌ Логику query expansion
- ❌ Relevance scoring
- ❌ Search result clustering
- ❌ Auto-complete с контекстом

##### **Whoosh (Python, но есть JS порт)**
```bash
npm install node-whoosh  # Менее функциональный
```

#### **💰 ROI для проекта:**
- **Экономия времени**: 3-4 недели разработки поисковой логики
- **Качество**: Проверенные алгоритмы от Google/Microsoft research  
- **Масштабируемость**: Handles millions of documents out-of-the-box

### **2. Multi-Criteria Decision Making (MCDM)**

#### **🎓 Научный контекст:**
- **Основатель**: Thomas Saaty (AHP method, 1970s)
- **Развитие**: Bernard Roy (ELECTRE), Jean-Pierre Brans (PROMETHEE)
- **Применение**: Operations Research, Decision Sciences

#### **🏢 Где применяется в продакшене:**
- **Netflix**: Content ranking с множественными критериями  
- **Booking.com**: Hotel ranking (price + rating + location + availability)
- **LinkedIn**: Job recommendations (salary + skills match + location + company)
- **Investment firms**: Portfolio optimization

#### **🛠️ Конкретные библиотеки:**

##### **mcdm-js (MIT лицензия)**
```bash
npm install mcdm-js
```

**Что дает:**
```javascript
import { TOPSIS, AHP, ELECTRE } from 'mcdm-js';

// Ранжирование авторов по множественным критериям
const criteria = [
  { name: 'semantic_similarity', weight: 0.35, type: 'max' },
  { name: 'context_similarity', weight: 0.25, type: 'max' },  
  { name: 'budget_compatibility', weight: 0.20, type: 'max' },
  { name: 'timeline_compatibility', weight: 0.15, type: 'max' },
  { name: 'story_quality', weight: 0.05, type: 'max' }
];

// Автоматическое ранжирование
const topsis = new TOPSIS();
const rankedAuthors = topsis.rank(authorsData, criteria);
// Получаем готовый ranking score для каждого автора
```

**Что НЕ придется писать:**
- ❌ Алгоритмы взвешенного scoring
- ❌ Normalization различных метрик
- ❌ Consistency checking для весов
- ❌ Sensitivity analysis

##### **js-criterium-decision-plus (Apache 2.0)**
```bash
npm install js-criterium-decision-plus
```
Более продвинутые методы: PROMETHEE, ELECTRE

#### **💰 ROI для проекта:**
- **Accuracy**: Научно обоснованные методы ранжирования
- **Flexibility**: Легко менять веса критериев для A/B testing
- **Transparency**: Пользователь понимает почему автор ранжирован выше

### **3. Personalized Recommender Systems**

#### **🎓 Научный контекст:**
- **Pioneers**: GroupLens Research (University of Minnesota, 1994)
- **Key papers**: "Item-Based Collaborative Filtering" (Amazon, 2001)
- **Modern research**: Deep Learning for RecSys (Google, Facebook)

#### **🏢 Реальные применения:**
- **Amazon**: "Customers who bought X also bought Y"
- **YouTube**: Video recommendations based on watch history
- **Airbnb**: Host recommendations based on previous stays
- **Tinder**: Profile matching algorithms

#### **🛠️ Конкретные библиотеки:**

##### **recombee-js-api-client (Commercial, но есть free tier)**
```bash
npm install recombee-api-client
```
**SaaS решение**, но очень мощное для персонализации.

##### **recommendation-js (MIT лицензия)**
```bash
npm install recommendation-js
```

**Что дает:**
```javascript
import { CollaborativeFiltering, ContentBased } from 'recommendation-js';

// Collaborative filtering для похожих пользователей
const cf = new CollaborativeFiltering();
cf.train(userPreferencesData);

// Content-based для похожих историй
const cb = new ContentBased();
cb.train(storiesContentData);

// Hybrid approach
const recommendations = cf.recommend(userId, 10)
  .combine(cb.recommend(userContext, 10))
  .deduplicate()
  .rerank();
```

**Что НЕ придется писать:**
- ❌ Matrix factorization algorithms
- ❌ Cold start problem handling
- ❌ User similarity calculations
- ❌ Content vectorization

#### **💰 ROI для проекта:**
- **Personalization**: Каждый пользователь получает уникальные рекомендации
- **Engagement**: Higher click-through rates на рекомендованных авторах
- **Learning**: Система улучшается с каждым взаимодействием

### **4. Adaptive User Interfaces**

#### **🎓 Научный контекст:**
- **Основатель**: Peter Brusilovsky (University of Pittsburgh)
- **Развитие**: Adaptive Hypermedia, Personalized UI research
- **Modern research**: Google Material Design, Apple Human Interface

#### **🏢 Где применяется:**
- **Spotify**: Interface адаптируется под музыкальные предпочтения
- **Microsoft Office**: Adaptive menus based on usage patterns
- **Google Workspace**: Progressive disclosure в Gmail, Drive
- **Salesforce**: Role-based interface adaptation

#### **🛠️ Конкретные решения:**

##### **XState (MIT лицензия)**
```bash
npm install xstate @xstate/react
```

**Что дает:**
```javascript
import { createMachine } from 'xstate';

// State machine для адаптивного workflow
const discoveryMachine = createMachine({
  id: 'discovery',
  initial: 'assessing_user',
  states: {
    assessing_user: {
      on: {
        NOVICE_USER: 'guided_discovery',
        EXPERT_USER: 'advanced_search',
        TIME_CONSTRAINED: 'quick_ai_prep'
      }
    },
    guided_discovery: {
      initial: 'progressive_narrowing',
      states: {
        progressive_narrowing: {
          on: {
            TOO_MANY_RESULTS: 'apply_constraint',
            TOO_FEW_RESULTS: 'relax_constraint',
            USER_SATISFIED: 'building_route'
          }
        }
      }
    }
  }
});
```

**Что НЕ придется писать:**
- ❌ Сложную логику состояний UI
- ❌ State transitions handling
- ❌ Complex conditional rendering logic

##### **React Hook Form + Yup для адаптивных форм**
```bash
npm install react-hook-form yup
```

#### **💰 ROI для проекта:**
- **User Experience**: Interface адаптируется под skill level пользователя
- **Conversion**: Меньше abandonment из-за сложности
- **Maintenance**: Четкая логика состояний = меньше багов

## 🚫 Что будет БЕЗ этих библиотек:

### **Без Elasticsearch:**
- ❌ **3-4 недели** на написание поисковой логики
- ❌ **Низкое качество** search relevance
- ❌ **Плохая производительность** на больших данных
- ❌ **Нет автоматических suggestions**

### **Без MCDM:**
- ❌ **Субъективное** ранжирование авторов
- ❌ **Сложность** балансировки критериев
- ❌ **Непрозрачность** для пользователей

### **Без Recommender Systems:**
- ❌ **Generic** recommendations для всех
- ❌ **Нет улучшения** со временем
- ❌ **Низкий engagement**

### **Без State Management:**
- ❌ **Spaghetti code** в UI логике  
- ❌ **Баги** в complex workflows
- ❌ **Сложность** тестирования

## 💰 Анализ лицензий:

| Библиотека | Лицензия | Коммерческое использование | Ограничения |
|-----------|----------|---------------------------|-------------|
| **Elasticsearch** | Apache 2.0 | ✅ Разрешено | Нет ограничений |
| **mcdm-js** | MIT | ✅ Разрешено | Нет ограничений |
| **recommendation-js** | MIT | ✅ Разрешено | Нет ограничений |
| **XState** | MIT | ✅ Разрешено | Нет ограничений |
| **Recombee** | Commercial SaaS | ✅ Платный | Free tier: 100K requests/month |

**Все основные библиотеки имеют permissive лицензии без ограничений для коммерческого использования.**

## 🎯 MVP Integration Plan:

### **Phase 1: Core Search (Elasticsearch)**
- Semantic search по историям
- Faceted filtering по constraints
- Query suggestions

### **Phase 2: Smart Ranking (MCDM)**  
- Multi-criteria author ranking
- Transparent scoring explanation
- A/B testing разных весов

### **Phase 3: Personalization (RecSys)**
- User preference learning
- Collaborative filtering
- Hybrid recommendations

### **Phase 4: Adaptive UI (XState)**
- State-driven workflow
- Progressive disclosure
- User skill adaptation

**Total integration effort: 2-3 sprints vs 8-10 sprints написания с нуля.**
