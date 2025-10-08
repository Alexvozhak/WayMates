# Dependency Injection & NestJS Architecture

## 🎯 Ключевые выводы

### **НЕ стоит писать DI Container с нуля**
- NestJS уже предоставляет готовый, протестированный DI Container
- Встроенная поддержка 3 типов scope: `DEFAULT` (Singleton), `REQUEST`, `TRANSIENT`
- Автоматическое управление жизненным циклом объектов
- Готовая интеграция с TypeScript и декораторами

### **Философия NestJS**
- **Модульность** - всё разделено на модули для переиспользования
- **Dependency Injection** - центральный паттерн всей архитектуры
- **Декларативный подход** - всё описывается декораторами
- **Design Patterns** - использование проверенных архитектурных решений
- **Extensibility, Testability** - расширяемость и тестируемость

## 🔍 Как работает DI Container

### **Структура данных**
```typescript
class Container {
  private services = new Map<string, ServiceDefinition>();
}

interface ServiceDefinition {
  implementation: any;        // Сам класс (конструктор)
  dependencies: string[];     // Список зависимостей
  instance?: any;            // Созданный экземпляр (для singleton)
  scope: 'singleton' | 'transient' | 'request';
}
```

### **Ключевые методы**
- **`register(key, implementation)`** - регистрирует сервис
- **`resolve(key)`** - создает экземпляр с автоматическим разрешением зависимостей
- **`get(key)`** - возвращает существующий экземпляр (для singleton)

## 🚫 Проблемы ручной реализации

### **1. Управление жизненным циклом**
```typescript
// ❌ Проблема: объекты создаются, но не сохраняются
resolve(key: string) {
  const deps = this.resolveDependencies(key);
  return new ServiceClass(...deps); // Объект создается и теряется
}
```

### **2. Сложность scope management**
- Singleton vs Transient vs Request-scoped
- Управление памятью
- Очистка ресурсов

### **3. Отсутствие метаданных**
- TypeScript reflection metadata
- Автоматическое извлечение зависимостей
- Валидация типов

## ✅ Преимущества NestJS DI

### **1. Автоматическая регистрация**
```typescript
@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private emailService: EmailService
  ) {}
}

// Автоматически регистрируется в модуле
@Module({
  providers: [UserService, UserRepository, EmailService]
})
export class UserModule {}
```

### **2. Встроенные scope'ы**
```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  // Новый экземпляр для каждого HTTP запроса
}

@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {
  // Новый экземпляр для каждого потребителя
}
```

### **3. Автоматическое управление зависимостями**
- Рекурсивное разрешение зависимостей
- Циклические зависимости detection
- Lazy loading
- Provider tokens

## 🏗️ Архитектурные решения для WayMates

### **Рекомендуемая структура**
```typescript
// 1. Core модули
@Module({
  providers: [
    LLMService,
    StorageService,
    ValidationService,
    RetrievalService,
    QueryProcessorService
  ]
})
export class CoreModule {}

// 2. Business модули
@Module({
  imports: [CoreModule],
  providers: [
    StoryService,
    QueryService,
    ModerationService
  ]
})
export class BusinessModule {}

// 3. API модули
@Module({
  imports: [BusinessModule],
  controllers: [StoryController, QueryController]
})
export class ApiModule {}
```

### **Интерфейсы и реализации**
```typescript
// Интерфейсы для абстракции
export interface ILLMService {
  generateResponse(prompt: string): Promise<string>;
}

// Реализации с DI
@Injectable()
export class OpenAIService implements ILLMService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService
  ) {}
  
  async generateResponse(prompt: string): Promise<string> {
    // Реализация
  }
}

// Provider token для интерфейса
export const LLM_SERVICE = 'LLM_SERVICE';

// В модуле
@Module({
  providers: [
    {
      provide: LLM_SERVICE,
      useClass: OpenAIService
    }
  ]
})
```

## 📊 Оценка количества интерфейсов

### **Текущее состояние: 5 основных**
1. `ILLMNode` - интерфейс языковых моделей
2. `IStorageNode` - интерфейс хранения данных
3. `IValidatorNode` - интерфейс валидации
4. `IRetrievalNode` - интерфейс поиска и извлечения
5. `IQueryProcessorNode` - интерфейс обработки запросов

### **Прогноз расширения: 15-25 интерфейсов**
- **Core Business (5-8)**: StoryService, QueryService, ModerationService
- **Infrastructure (5-8)**: DatabaseService, CacheService, QueueService
- **External APIs (3-5)**: LLMService, GraphService, NotificationService
- **Utilities (2-4)**: LoggerService, MetricsService, ConfigService

## 🎯 Следующие шаги

### **1. Изучить NestJS документацию**
- Dependency Injection patterns
- Module architecture
- Provider tokens
- Scope management

### **2. Спроектировать модульную структуру**
- Разделение на Core, Business, API слои
- Определение зависимостей между модулями
- Планирование интерфейсов

### **3. Создать базовую структуру проекта**
- NestJS CLI setup
- Базовые модули
- Интерфейсы и базовые реализации

## 📚 Полезные ресурсы

- [NestJS Official Documentation](https://docs.nestjs.com/)
- [NestJS Dependency Injection](https://docs.nestjs.com/providers)
- [NestJS Modules](https://docs.nestjs.com/modules)
- [NestJS Architecture](https://docs.nestjs.com/architecture)

---

*Документ создан на основе анализа NestJS документации и обсуждения архитектурных решений для WayMates*

