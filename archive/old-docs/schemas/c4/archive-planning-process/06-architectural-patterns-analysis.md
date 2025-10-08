# 🏗️ Архитектурные паттерны и терминология

## 📝 2. Единая терминология путешествия

### **Текущая проблема:**
```
Story → Plan → Goal? Route? Journey?
```
Нет четкой логики в названиях этапов.

### **Предлагаемая терминология:**

#### **Вариант A (путь-ориентированный):**
- **Story Discovery** → **Route Building** → **Journey Tracking**
- Логика: Находим истории → Строим маршрут → Отслеживаем путешествие

#### **Вариант B (процесс-ориентированный):**  
- **Story Matching** → **Plan Creation** → **Goal Achievement**
- Логика: Сопоставляем истории → Создаем план → Достигаем цель

#### **Вариант C (результат-ориентированный):**
- **Author Discovery** → **Route Generation** → **Progress Monitoring** 
- Логика: Открываем авторов → Генерируем маршрут → Мониторим прогресс

**Рекомендация: Вариант A** - наиболее логичная последовательность и понятная метафора путешествия.

### **Финальные названия сервисов:**
1. **Story Discovery Service** (поиск и сопоставление историй авторов)
2. **Route Building Service** (построение персонального маршрута)  
3. **Journey Tracking Service** (отслеживание выполнения путешествия)

## 🔧 3. Архитектурная независимость компонентов

### **Ключевое прозрение: Два измерения архитектуры**

Вы абсолютно правы! Есть **два независимых измерения**:

#### **Измерение 1: Workflow Approach (Подход к взаимодействию)**
- **AI Preparation**: AI выдает готовый результат
- **Interactive Review**: Пошаговое изучение с пользователем

#### **Измерение 2: Search Strategy (Стратегия поиска)**
- **Progressive Narrowing**: Широко → постепенно сужаем  
- **Strict Filtering**: Строгий фильтр сразу
- **Expand Search**: Узко → расширяем при нехватке результатов

### **Matrix комбинаций:**

| Workflow ↓ / Search Strategy → | Progressive Narrowing | Strict Filtering | Expand Search |
|-------------------------------|---------------------|-----------------|---------------|
| **AI Preparation** | ✅ AI анализирует широкую выборку, постепенно применяет constraints | ✅ AI использует строгий фильтр, выдает результат | ✅ AI начинает узко, расширяет при нехватке |
| **Interactive Review** | ✅ Пользователь участвует в процессе сужения | ✅ Пользователь изучает результаты строгого фильтра | ✅ Пользователь решает расширить поиск |

**Все 6 комбинаций валидны!**

### **NestJS DI Architecture:**

```typescript
// Абстрактные интерфейсы
interface IWorkflowStrategy {
  execute(userContext: UserContext): Promise<WorkflowResult>;
}

interface ISearchStrategy {
  findAuthors(userContext: UserContext): Promise<AuthorMatch[]>;
}

// Конкретные имплементации Workflow
@Injectable()
export class AIPreparationWorkflow implements IWorkflowStrategy {
  constructor(private searchStrategy: ISearchStrategy) {}
  
  async execute(userContext: UserContext): Promise<WorkflowResult> {
    const authors = await this.searchStrategy.findAuthors(userContext);
    return this.analyzeAndPrepareAutomatically(authors);
  }
}

@Injectable() 
export class InteractiveReviewWorkflow implements IWorkflowStrategy {
  constructor(private searchStrategy: ISearchStrategy) {}
  
  async execute(userContext: UserContext): Promise<WorkflowResult> {
    const authors = await this.searchStrategy.findAuthors(userContext);
    return this.reviewWithUser(authors);
  }
}

// Конкретные имплементации Search
@Injectable()
export class ProgressiveNarrowingSearch implements ISearchStrategy {
  async findAuthors(userContext: UserContext): Promise<AuthorMatch[]> {
    return this.progressivelyNarrowResults(userContext);
  }
}

@Injectable()
export class StrictFilteringSearch implements ISearchStrategy {
  async findAuthors(userContext: UserContext): Promise<AuthorMatch[]> {
    return this.applyStrictFilters(userContext);
  }
}

@Injectable()
export class ExpandSearchStrategy implements ISearchStrategy {
  async findAuthors(userContext: UserContext): Promise<AuthorMatch[]> {
    return this.startNarrowThenExpand(userContext);
  }
}

// Главный сервис использует DI
@Injectable()
export class StoryDiscoveryService {
  constructor(
    @Inject('WORKFLOW_STRATEGY') private workflowStrategy: IWorkflowStrategy,
    @Inject('SEARCH_STRATEGY') private searchStrategy: ISearchStrategy
  ) {}
  
  async discoverStories(userContext: UserContext): Promise<DiscoveryResult> {
    // Workflow strategy автоматически использует injected search strategy
    return this.workflowStrategy.execute(userContext);
  }
}

// Конфигурация через Module
@Module({
  providers: [
    StoryDiscoveryService,
    {
      provide: 'WORKFLOW_STRATEGY',
      useClass: InteractiveReviewWorkflow, // MVP = Interactive Review
    },
    {
      provide: 'SEARCH_STRATEGY', 
      useClass: ProgressiveNarrowingSearch, // MVP = Progressive Narrowing
    },
    // Все остальные стратегии для будущего использования
    AIPreparationWorkflow,
    StrictFilteringSearch,
    ExpandSearchStrategy,
  ],
})
export class StoryDiscoveryModule {}
```

### **Преимущества этой архитектуры:**
- ✅ **Композиция**: Легко комбинировать любые подходы
- ✅ **Расширяемость**: Добавить новую стратегию = создать класс
- ✅ **Тестируемость**: Каждую стратегию можно тестировать отдельно
- ✅ **A/B тестинг**: Переключение конфигурацией
- ✅ **Персонализация**: Разные стратегии для разных пользователей

## 🔬 5. Научные области и готовые решения

### **Научные области:**

#### **1. Interactive Information Retrieval (IIR)**
- **Что изучает**: Итеративный поиск с участием пользователя
- **Применение**: Interactive Review workflow
- **Ключевые концепции**: Query reformulation, relevance feedback, progressive search

#### **2. Multi-Criteria Decision Making (MCDM)**  
- **Что изучает**: Принятие решений с множественными критериями
- **Применение**: Constraints management, author ranking
- **Методы**: AHP, TOPSIS, ELECTRE, VIKOR

#### **3. Personalized Recommender Systems**
- **Что изучает**: Персонализированные рекомендации
- **Применение**: Author matching, content filtering  
- **Подходы**: Collaborative filtering, content-based, hybrid methods

#### **4. Adaptive User Interfaces**
- **Что изучает**: Интерфейсы адаптирующиеся к пользователю
- **Применение**: Dynamic workflow selection
- **Концепции**: User modeling, interface adaptation, progressive disclosure

### **Готовые библиотеки и фреймворки:**

#### **Search & Filtering:**
```bash
# Elasticsearch - для сложных поисковых запросов
npm install @elastic/elasticsearch

# Apache Lucene через JavaScript
npm install lucene-query-parser

# Multi-criteria decision making
npm install mcdm-js  # TOPSIS, AHP implementations
```

#### **Recommendation Engines:**
```bash
# Рекомендательные системы
npm install recommendation-engine
npm install collaborative-filter

# Machine Learning для персонализации  
npm install ml-matrix
npm install natural  # NLP processing
```

#### **Strategy Pattern Libraries:**
```bash
# Strategy pattern helpers
npm install strategy-pattern
npm install configurable-strategy

# State machines для workflow
npm install xstate
npm install finite-automata
```

### **Конкретные применения:**

#### **1. Elasticsearch Query DSL для Progressive Narrowing:**
```javascript
// Начинаем с широкого поиска
const wideQuery = {
  query: {
    bool: {
      should: [
        { match: { skills: userContext.skills }},
        { match: { target_location: userContext.target_location }}
      ]
    }
  }
};

// Постепенно добавляем constraints как filters
const narrowedQuery = {
  ...wideQuery,
  query: {
    ...wideQuery.query,
    bool: {
      ...wideQuery.query.bool,
      filter: [
        { range: { budget: { lte: userContext.constraints.max_budget }}},
        { range: { hours_per_week: { lte: userContext.constraints.max_hours }}}
      ]
    }
  }
};
```

#### **2. MCDM для Author Ranking:**
```javascript
import { TOPSIS } from 'mcdm-js';

// Критерии для ранжирования авторов
const criteria = [
  { name: 'similarity', weight: 0.4, type: 'max' },
  { name: 'budget_fit', weight: 0.3, type: 'max' },  
  { name: 'timeline_fit', weight: 0.3, type: 'max' }
];

// Применяем TOPSIS для ранжирования
const topsis = new TOPSIS();
const rankedAuthors = topsis.rank(authors, criteria);
```

#### **3. XState для Workflow Management:**
```javascript
import { Machine } from 'xstate';

const discoveryWorkflowMachine = Machine({
  id: 'discovery',
  initial: 'selecting_strategy',
  states: {
    selecting_strategy: {
      on: {
        'CHOOSE_INTERACTIVE': 'interactive_review',
        'CHOOSE_AI_PREP': 'ai_preparation'
      }
    },
    interactive_review: {
      initial: 'progressive_narrowing',
      states: {
        progressive_narrowing: {
          on: {
            'APPLY_CONSTRAINT': 'filtering',
            'USER_CHOICE': 'user_decision'
          }
        },
        // ... другие состояния
      }
    },
    ai_preparation: {
      // ... AI workflow states
    }
  }
});
```

## 🎯 Рекомендованная MVP архитектура

### **Стратегии для MVP:**
- **Workflow**: Interactive Review (trust building)
- **Search**: Progressive Narrowing (discovery + flexibility)

### **Заложенность на будущее:**
- ✅ Интерфейсы для всех 6 комбинаций
- ✅ DI configuration для легкого переключения
- ✅ Готовые библиотеки для сложной логики (MCDM, Elasticsearch)
- ✅ State machines для workflow management

### **Научные методы:**
- **Interactive Information Retrieval** для user feedback loops
- **Multi-Criteria Decision Making** для author ranking
- **Adaptive UI patterns** для динамического workflow

Эта архитектура дает максимальную гибкость при минимальной сложности для MVP. Готов детализировать любой аспект!
