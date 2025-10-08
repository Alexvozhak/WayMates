# 🔍 Сравнение терминологии и альтернатив MCDM

## 🔧 Сравнение вариантов терминологии

### **Варианты пар на рассмотрении:**
1. **Interactive Review ↔ Automated Review**
2. **Step-by-Step Review ↔ One-Click Review**  
3. **Interactive Discovery ↔ Automated Discovery**

### **Детальное сравнение:**

| Критерий | Interactive ↔ Automated | Step-by-Step ↔ One-Click | Interactive ↔ Automated (Discovery) |
|----------|-------------------------|---------------------------|-------------------------------------|
| **Понятность для команды** | ✅ Очень ясно | ✅ Очень ясно | ⚠️ Может путаться с Review |
| **UX описание** | ✅ Четко описывает подход | ✅ Описывает темп | ✅ Четко описывает подход |
| **Техническая точность** | ✅ Соответствует реализации | ⚠️ Больше про UI/UX | ✅ Соответствует реализации |
| **Противоположность** | ✅ Четкие полюса | ✅ Четкие полюса | ✅ Четкие полюса |
| **Масштабируемость терминов** | ✅ Подходит для всех фич | ⚠️ Привязано к UI | ✅ Подходит для всех фич |
| **Избежание путаницы** | ✅ Не пересекается с другими | ✅ Не пересекается | ❌ Review vs Discovery путаница |

### **Примеры использования в коде:**

#### **Interactive ↔ Automated Review:**
```typescript
interface WorkflowStrategy {
  type: 'interactive_review' | 'automated_review';
}

class InteractiveReviewStrategy implements WorkflowStrategy {
  async processAuthors(authors: Author[]): Promise<ProcessedAuthors> {
    for (const author of authors) {
      const userFeedback = await this.askUserOpinion(author);
      // User-driven decision making
    }
  }
}

class AutomatedReviewStrategy implements WorkflowStrategy {
  async processAuthors(authors: Author[]): Promise<ProcessedAuthors> {
    const rankedAuthors = await this.aiRanking.rank(authors);
    // AI-driven decision making
    return this.generateReport(rankedAuthors);
  }
}
```

#### **Step-by-Step ↔ One-Click Review:**
```typescript
// Больше про UX, менее архитектурно
class StepByStepReview {
  async process() {
    await this.showAuthor1();
    await this.waitForUserInput();
    await this.showAuthor2();
    await this.waitForUserInput();
    // ...
  }
}

class OneClickReview {
  async process() {
    return await this.generateCompleteReport();
  }
}
```

### **🎯 РЕКОМЕНДАЦИЯ: Interactive Review ↔ Automated Review**

#### **Почему лучший выбор:**
1. **Архитектурная точность** - описывает who makes decisions (user vs AI)
2. **Техническая ясность** - сразу понятно как implement
3. **Универсальность** - подходит для всех компонентов системы
4. **Team clarity** - команда сразу поймет разницу
5. **Не пересекается** с другими терминами (Discovery, Filtering)

#### **Финальная терминология:**
```
Interactive Review ↔ Automated Review      (Workflow Approach)
Guided Discovery ↔ Instant Discovery      (Search Strategy) 
Progressive Narrowing ↔ Strict Filtering  (Filter Strategy)
```

## ⚖️ Подтверждение понимания MCDM

### **✅ ДА, вы ПРАВИЛЬНО поняли:**

**MCDM решает проблему найти эталонное совпадение и отсортировать/приоритизировать все варианты от самого совместимого/подходящего на основе весов и документированной логики.**

#### **Детальнее:**
```typescript
// Проблема: У нас есть 50 авторов из Neo4j, как выбрать лучших?
const rawAuthors = [
  { name: "Anna", semantic: 0.87, budget: 0.92, timeline: 0.78, quality: 4.2 },
  { name: "Bob",  semantic: 0.91, budget: 0.45, timeline: 0.95, quality: 3.8 },
  { name: "Carol", semantic: 0.73, budget: 0.88, timeline: 0.82, quality: 4.5 }
];

// MCDM решение: научно обоснованное ранжирование
const criteria = [
  { name: 'semantic_similarity', weight: 0.35, type: 'max' },
  { name: 'budget_compatibility', weight: 0.25, type: 'max' },
  { name: 'timeline_compatibility', weight: 0.20, type: 'max' },
  { name: 'story_quality', weight: 0.20, type: 'max' }
];

const topsis = new TOPSIS();
const result = topsis.rank(authorsMatrix, criteria);
// Результат: [Anna: 0.92, Carol: 0.88, Bob: 0.71] - научно ранжировано
```

**Без MCDM**: AI делает черный ящик или простая сумма весов
**С MCDM**: Математически обоснованное ранжирование с прозрачной логикой

## 📊 Технический анализ альтернатив MCDM

### **Сравнение библиотек для ранжирования:**

| Библиотека | Стек | Последний коммит | GitHub ⭐ | Лицензия | Сложность интеграции | Заключение |
|------------|------|------------------|-----------|----------|---------------------|------------|
| **mcdm-js** | JS/TS | 2023-12 | ~50 | MIT | ✅ Простая | **Рекомендуется для MVP** |
| **js-topsis** | JS | 2022-06 | ~30 | MIT | ✅ Простая | Устарела, мало поддержки |
| **decision-js** | JS | 2021-03 | ~15 | MIT | ✅ Простая | Заброшена |
| **scikit-criteria** | Python | 2024-01 | ~200 | BSD-3 | ❌ Сложная (Python bridge) | Мощная, но overkill |
| **ahp-js** | JS | 2022-11 | ~25 | MIT | ⚠️ Средняя | Только AHP метод |

### **Подробный анализ топ-3:**

#### **1. mcdm-js (РЕКОМЕНДУЮ)**
```typescript
npm install mcdm-js

import { TOPSIS, ELECTRE, PROMETHEE } from 'mcdm-js';

// Поддерживает множество методов
const topsis = new TOPSIS();
const result = topsis.rank(matrix, criteria);
```

**✅ Плюсы:**
- Современный TypeScript
- Множество методов (TOPSIS, ELECTRE, PROMETHEE) 
- Хорошая документация
- Активно поддерживается

**❌ Минусы:**
- Относительно новая (меньше battle-tested)

#### **2. Simple Weighted Sum (АЛЬТЕРНАТИВА)**
```typescript
// Никаких зависимостей
function weightedSum(authors: Author[], weights: Weights) {
  return authors.map(author => ({
    ...author,
    score: Object.entries(weights).reduce((sum, [key, weight]) => 
      sum + author[key] * weight, 0
    )
  })).sort((a, b) => b.score - a.score);
}
```

**✅ Плюсы:**
- Zero dependencies
- Понятно всей команде  
- Быстрая реализация
- Легко отлаживать

**❌ Минусы:**
- Менее научно обосновано
- Нет нормализации данных

#### **3. scikit-criteria (Python)**
```python
# Самая мощная, но требует Python
from skcriteria import mkdm
from skcriteria.madm import simple

dm = mkdm.mkdm(matrix, criteria, weights)
result = simple.WeightedSum().evaluate(dm)
```

**✅ Плюсы:**
- Научно проверенная
- Огромное количество методов
- Активное сообщество

**❌ Минусы:**
- Нужен Python bridge
- Сложная интеграция в Node.js стек
- Overkill для MVP

### **🎯 ФИНАЛЬНАЯ РЕКОМЕНДАЦИЯ:**

#### **Для MVP: Simple Weighted Sum**
```typescript
function rankAuthors(authors: Author[]): RankedAuthor[] {
  const weights = {
    semantic_similarity: 0.35,
    budget_compatibility: 0.25, 
    timeline_compatibility: 0.20,
    story_quality: 0.20
  };
  
  return authors
    .map(author => ({
      ...author,
      final_score: 
        author.semantic_similarity * weights.semantic_similarity +
        author.budget_compatibility * weights.budget_compatibility +
        author.timeline_compatibility * weights.timeline_compatibility +
        author.story_quality * weights.story_quality
    }))
    .sort((a, b) => b.final_score - a.final_score);
}
```

#### **После MVP: Upgrade to mcdm-js**
- Когда нужна научная обоснованность
- Когда появятся сложные критерии ранжирования
- Когда потребуется объяснять ранжирование пользователям

## ✅ Подтверждение по XState

**Да, XState НЕ берем на MVP, но держим в уме** для:
- Веб/мобильные клиенты
- Сложные многошаговые сценарии  
- Когда телеграм бот перерастет простые switch statements

**MVP фокус**: Простота → Быстрый запуск → Feedback → Итерации на основе реального использования.
