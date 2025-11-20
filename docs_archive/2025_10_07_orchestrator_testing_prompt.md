# 🧪 Промпт для создания тестов оркестратора WayMates

> **Цель:** Создать полное покрытие тестами модулей `@orcestrator/` без моков, с использованием реальных данных из `@trails/` и автоматическим определением типа тестов (unit/integration/functional).

---

## 🎯 Задачи

### 1. Покрыть `@orcestrator/` тестами
- **Автоматическое определение типа тестов** (unit/integration/functional)
- **Никаких моков** - только реальные данные из `@trails/`
- **Проверка продакшн логики** - тесты не подгонять под результат
- **Фиктивные тесты не нужны** - если тест падает, значит есть проблема в коде

### 2. Рефакторинг существующих тестов
- **Убрать все моки** из текущих тестов
- **Перевести на реальные данные** из `@trails/`
- **Перенести в правильные категории** (integration/functional)

---

## 📁 Структура тестов

### Unit тесты (`tests/unit/orcestrator/`)
**Что тестировать:**
- Чистые функции без внешних зависимостей
- Логика валидации и трансформации данных
- Алгоритмы и вычисления

**Примеры:**
- `PresetsManager.load()` - загрузка и валидация пресетов
- `buildCurrentToTargetQuery()` - построение Cypher запросов
- `getOptimalFieldOrder()` - расчет селективности

### Integration тесты (`tests/integration/orcestrator/`)
**Что тестировать:**
- Взаимодействие с Neo4j
- Cypher запросы и их результаты
- Интеграция между компонентами оркестратора

**Примеры:**
- `QueryOrchestrator.generateCurrentContextQuery()` - генерация запросов к БД
- `buildQueryFromConfig()` - построение запросов из конфигурации
- `runProfile()` - профилирование запросов

### Functional тесты (`tests/functional/orcestrator/`)
**Что тестировать:**
- Полные workflow оркестратора
- End-to-end сценарии
- Интеграция с MCP tools

**Примеры:**
- Полный цикл поиска через `QueryOrchestrator`
- Обработка больших датасетов через `getOptimalFieldOrder()`
- Интеграция с `executeUpsertStory()`

---

## 🚫 Запреты

- **НЕ использовать моки** - только реальные данные
- **НЕ подгонять тесты** под результат
- **НЕ создавать фиктивные тесты** - если падает, значит есть баг
- **НЕ тестировать implementation details** - только публичный API

---

## 📊 Данные для тестов

### Источники данных
- `data/trails/generated_migrated/*.json` - реальные трейлы
- `data/gold/gold_labels.json` - золотые стандарты
- `config/presets.json` - конфигурация пресетов

### Загрузка данных
```typescript
import { loadTestData } from '../helpers/test-data-loader';

const testData = loadTestData("USER_005");
const result = await executeUpsertStory(driver, testData);
```

---

## 🔧 Настройка тестов

### Docker окружение
```bash
# Запуск тестовой БД
npm run test:integration:setup

# Очистка после тестов
npm run test:integration:cleanup
```

### Помощники
- `setupIntegrationTest()` - настройка БД
- `teardownIntegrationTest()` - очистка БД
- `loadTestData()` - загрузка тестовых данных

---

## 📝 Примеры тестов

### Unit тест
```typescript
describe("PresetsManager", () => {
  test("load loads and validates presets", () => {
    const manager = new PresetsManager("./config/presets.json");
    manager.load();
    const presets = manager.getAll();
    
    expect(presets).toBeDefined();
    expect(Object.keys(presets).length).toBeGreaterThan(0);
    expect(presets["default"]).toHaveProperty('strictPresets');
    expect(presets["default"]).toHaveProperty('flexiblePresets');
  });
});
```

### Integration тест
```typescript
describe("QueryOrchestrator", () => {
  test("generateCurrentContextQuery returns valid Cypher", async () => {
    const presetsManager = new PresetsManager("./config/presets.json");
    presetsManager.load();
    const orchestrator = new QueryOrchestrator(presetsManager, driver);
    
    const userContext = { position: "developer", industry: "tech" };
    const query = await orchestrator.generateCurrentContextQuery("default", userContext);
    
    expect(query).toBeDefined();
    expect(query).toContain("MATCH");
    expect(query).toContain("Context");
  });
});
```

### Functional тест
```typescript
describe("Orchestrator Workflow", () => {
  test("full search workflow works end-to-end", async () => {
    // Загружаем реальные данные
    const testData = loadTestData("USER_005");
    await executeUpsertStory(driver, testData);
    
    // Настраиваем оркестратор
    const presetsManager = new PresetsManager("./config/presets.json");
    presetsManager.load();
    const orchestrator = new QueryOrchestrator(presetsManager, driver);
    
    // Генерируем запросы
    const currentQuery = await orchestrator.generateCurrentContextQuery("default", testData.contexts[0]);
    const targetQuery = await orchestrator.generateTargetContextQuery("default");
    
    expect(currentQuery).toBeDefined();
    expect(targetQuery).toBeDefined();
    expect(currentQuery).toContain("Context");
    expect(targetQuery).toContain("Context");
  });
});
```

---

## 🎯 Критерии успеха

- **100% покрытие** модулей `@orcestrator/`
- **0 моков** в тестах
- **Реальные данные** из `@trails/`
- **Автоматическое определение** типа тестов
- **Проверка продакшн логики** без подгонки

---

## 📋 Чек-лист

- [ ] Создать unit тесты для чистых функций
- [ ] Создать integration тесты для работы с БД
- [ ] Создать functional тесты для полных workflow
- [ ] Убрать все моки из существующих тестов
- [ ] Перевести тесты на реальные данные
- [ ] Перенести тесты в правильные категории
- [ ] Проверить, что тесты падают при изменении логики
- [ ] Убедиться, что тесты проверяют продакшн код

---

*Ключевая мысль: **Тесты должны проверять реальную логику, а не подгоняться под результат***
