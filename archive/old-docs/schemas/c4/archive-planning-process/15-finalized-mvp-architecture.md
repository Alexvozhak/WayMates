# 🎯 Финализированная MVP архитектура WayMates

## ✅ Все решения ЗАФИКСИРОВАНЫ

### **🔧 Консистентная терминология (Service-based):**
```typescript
Interactive Casting Service ↔ Automated Casting Service    (Workflow Services)
Expand Search Service ↔ Narrow Search Service              (Search Services)
```

### **🏗️ Архитектурные решения:**

#### **1. MCDM Ranking Architecture (исправлено)**
```typescript
// Все методы реализуются за 5-10 минут с mcdm-js!
interface MCDMService {
  rank(authors: Author[], criteria: Criteria[]): RankedAuthor[];
}

@Injectable()
export class TopsisService implements MCDMService {
  rank(authors: Author[], criteria: Criteria[]): RankedAuthor[] {
    const topsis = new TOPSIS();
    return topsis.rank(this.authorsToMatrix(authors), criteria);
  }
}

@Injectable()
export class VikorService implements MCDMService {
  rank(authors: Author[], criteria: Criteria[]): RankedAuthor[] {
    const vikor = new VIKOR();
    return vikor.rank(this.authorsToMatrix(authors), criteria);
  }
}

// Переключение методов = 1 строчка в конфиге!
@Module({
  providers: [
    {
      provide: 'MCDMService',
      useClass: TopsisService,        // ← Меняем здесь
    },
  ],
})
```

#### **2. Search Services Architecture:**
```typescript
@Injectable()
export class ExpandSearchService implements SearchService {
  async search(context: UserContext): Promise<Author[]> {
    // Начинаем узко → расширяем если мало результатов
    let results = await this.neo4j.strictSearch(context);
    if (results.length < 5) {
      results = await this.neo4j.skillsOnlySearch(context);
    }
    if (results.length < 5) {
      results = await this.neo4j.broadSearch(context);
    }
    return results;
  }
}

@Injectable()
export class NarrowSearchService implements SearchService {
  async search(context: UserContext): Promise<Author[]> {
    // Начинаем широко → сужаем до оптимального количества
    let results = await this.neo4j.broadSearch(context);
    while (results.length > 20) {
      results = await this.applyAdditionalFilters(results);
    }
    return results.slice(0, 15);
  }
}
```

#### **3. Casting Services Architecture:**
```typescript
@Injectable()
export class InteractiveCastingService implements CastingService {
  async cast(authors: Author[], context: UserContext): Promise<CastingResult> {
    const selectedAuthors = [];
    
    for (const author of authors) {
      // Пользователь "примеряет" контекст автора
      const contextFeedback = await this.bot.askUser(
        `Подходят ли вам обстоятельства автора ${author.name}?`
      );
      
      if (contextFeedback.relevant) {
        const storyFeedback = await this.bot.askUser(
          `Что из истории ${author.name} готовы перенять?`
        );
        selectedAuthors.push({ ...author, userInsights: storyFeedback });
      }
    }
    
    return { selectedAuthors };
  }
}

@Injectable()
export class AutomatedCastingService implements CastingService {
  async cast(authors: Author[], context: UserContext): Promise<CastingResult> {
    const contextMatches = await this.ai.matchContexts(authors, context);
    const storyAnalysis = await this.ai.analyzeStories(contextMatches);
    const hybridPlan = await this.ai.synthesizePlan(storyAnalysis, context);
    
    return {
      selectedAuthors: contextMatches,
      hybridPlan,
      explanation: "AI проанализировал контексты и истории"
    };
  }
}
```

## 🚀 MVP Implementation Plan

### **Phase 1: Core Architecture (1 день)**
```typescript
// День 1: Базовая DI архитектура
- Setup NestJS DI containers
- Implement MCDMService interface  
- Implement SearchService interface
- Implement CastingService interface
- Basic Telegram bot setup
```

### **Phase 2: MVP Services (1-2 дня)**
```typescript
// День 2-3: Базовые имплементации
- TopsisService (5 минут с mcdm-js)
- ExpandSearchService 
- InteractiveCastingService
- Basic Neo4j integration
```

### **Phase 3: Testing & A/B (1 день)**
```typescript
// День 4: Эксперименты
- Add VikorService (5 минут)
- Add SimpleWeightedService (5 минут)  
- A/B test ranking methods
- Choose best performing method
```

## ⚡ Архитектурные преимущества

### **1. Быстрое переключение методов:**
```typescript
// Смена MCDM метода = 1 строчка
export const RANKING_CONFIG = {
  method: 'TOPSIS',  // было: 'SIMPLE_WEIGHTED'
};
```

### **2. Простое A/B тестирование:**
```typescript
@Injectable()
export class RankingExperimentService {
  async compareAllMethods(authors: Author[]): Promise<ComparisonResult> {
    const results = await Promise.all([
      this.topsis.rank(authors, criteria),
      this.vikor.rank(authors, criteria), 
      this.simple.rank(authors, criteria),
    ]);
    return this.analyzeResults(results);
  }
}
```

### **3. Готовность к масштабированию:**
```typescript
// Добавление нового метода = 5-10 минут
@Injectable()
export class PrometheeService implements MCDMService {
  rank(authors: Author[], criteria: Criteria[]): RankedAuthor[] {
    const promethee = new PROMETHEE_II();
    return promethee.rank(this.authorsToMatrix(authors), criteria);
  }
}
```

## 📊 Technology Stack

```typescript
const MVP_STACK = {
  backend: 'NestJS + TypeScript',
  database: 'Neo4j (graph + vectors)',
  mcdm: 'mcdm-js library',
  ai: 'LangGraph workflows', 
  interface: 'Telegram Bot API',
  
  // Архитектурные возможности
  ranking_methods: ['TOPSIS', 'VIKOR', 'PROMETHEE', 'SimpleWeighted'],
  search_strategies: ['ExpandSearch', 'NarrowSearch'],
  casting_approaches: ['Interactive', 'Automated'],
};
```

## ⏭️ Готов к Creative Mode

### **Единственный компонент требующий творческой проработки:**

**Telegram Bot Interactive Casting Service Flow** - как спроектировать интуитивные диалоги для "примерки контекстов" авторов с поддержкой Expand/Narrow Search Service стратегий.

### **Все остальное = техническая реализация:**
- ✅ MCDM архитектура - готова
- ✅ Search Services - готовы  
- ✅ Service-based терминология - готова
- ✅ DI pattern для быстрого переключения - готов

**Архитектурный выигрыш**: Готовность к быстрому переключению MCDM методов (5-10 минут на новый метод) + возможность A/B тестирования + простота масштабирования.

---

## 🎯 СТАТУС: PLANNING MODE → CREATIVE MODE

**Задача Creative Mode**: Спроектировать UX диалогов для Interactive Casting Service в Telegram боте с поддержкой обеих Search Services стратегий.
