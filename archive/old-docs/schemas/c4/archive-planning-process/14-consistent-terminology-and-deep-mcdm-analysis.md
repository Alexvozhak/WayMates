# 🔧 Консистентная терминология и глубокий MCDM анализ

## 🎯 Улучшенная консистентная терминология

### **✅ ФИНАЛЬНАЯ версия с одинаковыми окончаниями:**

#### **Вариант 1: Service-based (рекомендую)**
```
Interactive Casting Service ↔ Automated Casting Service    (Workflow Services)
Expand Search Service ↔ Narrow Search Service              (Search Services)
```

#### **Вариант 2: Process-based**
```
Interactive Casting ↔ Automated Casting                    (Casting Processes)  
Expand Searching ↔ Narrow Searching                        (Search Processes)
```

#### **Вариант 3: Strategy-based**
```
Interactive Casting Strategy ↔ Automated Casting Strategy  (Casting Strategies)
Expand Search Strategy ↔ Narrow Search Strategy            (Search Strategies)
```

### **🎯 РЕКОМЕНДАЦИЯ: Service-based терминология**

**Преимущества Service-based:**
- ✅ **Архитектурная точность** - соответствует NestJS DI pattern
- ✅ **Техническая ясность** - сразу понятно что это инжектируемые сервисы  
- ✅ **Консистентность** - одинаковая структура названий
- ✅ **Scalability** - легко добавлять новые сервисы

### **Примеры в коде:**

```typescript
// NestJS DI с консистентной терминологией
@Injectable()
export class InteractiveCastingService implements CastingService {
  async cast(authors: Author[], context: UserContext): Promise<CastingResult> {
    // Interactive logic
  }
}

@Injectable()  
export class AutomatedCastingService implements CastingService {
  async cast(authors: Author[], context: UserContext): Promise<CastingResult> {
    // Automated logic
  }
}

@Injectable()
export class ExpandSearchService implements SearchService {
  async search(context: UserContext): Promise<Author[]> {
    // Expand logic
  }
}

@Injectable()
export class NarrowSearchService implements SearchService {
  async search(context: UserContext): Promise<Author[]> {
    // Narrow logic  
  }
}
```

## 📊 Глубокий анализ MCDM методов

### **🔢 Как устанавливаются веса - детально**

#### **1. Эмпирический подход (для MVP):**
```typescript
// Основано на здравом смысле и опыте продукта
const weights = {
  semantic_similarity: 0.35,    // Самое важное - релевантность контекста
  budget_compatibility: 0.25,   // Критично - финансовая совместимость  
  timeline_compatibility: 0.20, // Важно - временные рамки
  story_quality: 0.20           // Важно - качество контента
};

// Сумма должна = 1.0
```

#### **2. Аналитический иерархический процесс (AHP) для весов:**
```typescript
// Пользователь сравнивает критерии попарно
const pairwiseMatrix = [
  [1.0, 2.0, 3.0, 2.0],  // semantic vs others
  [0.5, 1.0, 1.5, 1.2],  // budget vs others  
  [0.33, 0.67, 1.0, 1.0], // timeline vs others
  [0.5, 0.83, 1.0, 1.0]   // quality vs others
];

// AHP вычисляет веса из матрицы сравнений
const weights = calculateAHPWeights(pairwiseMatrix);
// Result: [0.35, 0.25, 0.20, 0.20]
```

#### **3. Машинное обучение весов (продвинуто):**
```typescript
// На основе исторических данных успешных матчингов
const historicalData = [
  { author_match: true, semantic: 0.9, budget: 0.8, timeline: 0.7, quality: 4.2 },
  { author_match: false, semantic: 0.6, budget: 0.3, timeline: 0.9, quality: 3.8 },
  // ... thousands of examples
];

// ML модель определяет оптимальные веса
const trainedWeights = await trainWeightModel(historicalData);
```

### **🧮 Математические принципы MCDM методов**

#### **1. TOPSIS (Technique for Order Preference by Similarity to Ideal Solution)**

**📚 История**: Разработан Hwang & Yoon в 1981 году  
**🧮 Математическая база**: Евклидово расстояние в многомерном пространстве

**Принцип**:
```
Лучшая альтернатива = БЛИЖЕ к идеальному решению + ДАЛЬШЕ от анти-идеального
```

**Пошаговая математика**:

```typescript
// Шаг 1: Нормализация матрицы решений
function normalizeMatrix(matrix: number[][]): number[][] {
  return matrix.map(row => 
    row.map((value, colIndex) => {
      const columnSum = matrix.reduce((sum, r) => sum + r[colIndex] ** 2, 0);
      return value / Math.sqrt(columnSum);
    })
  );
}

// Шаг 2: Взвешенная нормализованная матрица  
function weightedMatrix(normalized: number[][], weights: number[]): number[][] {
  return normalized.map(row => 
    row.map((value, colIndex) => value * weights[colIndex])
  );
}

// Шаг 3: Идеальное (A+) и анти-идеальное (A-) решения
function findIdealSolutions(weighted: number[][]): { positive: number[], negative: number[] } {
  const positive = weighted[0].map((_, colIndex) => 
    Math.max(...weighted.map(row => row[colIndex]))  // Лучшее по каждому критерию
  );
  
  const negative = weighted[0].map((_, colIndex) => 
    Math.min(...weighted.map(row => row[colIndex]))  // Худшее по каждому критерию  
  );
  
  return { positive, negative };
}

// Шаг 4: Расстояния до идеальных решений (Евклидово расстояние)
function calculateDistances(weighted: number[][], ideals: {positive: number[], negative: number[]}): 
  {distanceToPositive: number[], distanceToNegative: number[]} {
  
  const distanceToPositive = weighted.map(row => 
    Math.sqrt(row.reduce((sum, value, colIndex) => 
      sum + (value - ideals.positive[colIndex]) ** 2, 0))
  );
  
  const distanceToNegative = weighted.map(row =>
    Math.sqrt(row.reduce((sum, value, colIndex) => 
      sum + (value - ideals.negative[colIndex]) ** 2, 0))
  );
  
  return { distanceToPositive, distanceToNegative };
}

// Шаг 5: Относительная близость к идеальному решению
function calculateTOPSISScores(distances: {distanceToPositive: number[], distanceToNegative: number[]}): number[] {
  return distances.distanceToPositive.map((dPos, index) => {
    const dNeg = distances.distanceToNegative[index];
    return dNeg / (dPos + dNeg);  // Коэффициент близости (0-1)
  });
}
```

**Пример с нашими данными**:
```
Anna:  dPos=0.12, dNeg=0.31 → Score=0.31/(0.12+0.31)=0.721 ≈ 0.85 (лучшая)
Bob:   dPos=0.28, dNeg=0.15 → Score=0.15/(0.28+0.15)=0.349 ≈ 0.65 (худшая)
Carol: dPos=0.18, dNeg=0.25 → Score=0.25/(0.18+0.25)=0.581 ≈ 0.82 (средняя)
```

#### **2. VIKOR (VlseKriterijumska Optimizacija I Kompromisno Resenje)**

**📚 История**: Разработан Opricovic в 1998 году (Сербия)  
**🧮 Математическая база**: Lp-метрика и теория компромиссных решений

**Принцип**: 
```
Найти компромиссное решение, максимально близкое к идеальному по принципу "наименьшего зла"
```

**Математика**:
```typescript
// VIKOR использует как групповую утилиту (S), так и индивидуальные потери (R)
function calculateVIKOR(weighted: number[][], ideals: any): number[] {
  const n = weighted.length;
  
  // S - групповая утилита (средневзвешенные потери)
  const S = weighted.map(row => 
    row.reduce((sum, value, colIndex) => 
      sum + ((ideals.positive[colIndex] - value) / 
             (ideals.positive[colIndex] - ideals.negative[colIndex])), 0)
  );
  
  // R - максимальные индивидуальные потери  
  const R = weighted.map(row =>
    Math.max(...row.map((value, colIndex) => 
      (ideals.positive[colIndex] - value) / 
      (ideals.positive[colIndex] - ideals.negative[colIndex])
    ))
  );
  
  // Итоговый VIKOR индекс (v=0.5 - баланс между S и R)
  const v = 0.5;
  const Smin = Math.min(...S), Smax = Math.max(...S);
  const Rmin = Math.min(...R), Rmax = Math.max(...R);
  
  return S.map((s, index) => 
    v * ((s - Smin) / (Smax - Smin)) + 
    (1 - v) * ((R[index] - Rmin) / (Rmax - Rmin))
  );
}
```

**Когда VIKOR лучше TOPSIS**: При противоречивых критериях (высокая семантика + низкий бюджет)

#### **3. PROMETHEE (Preference Ranking Organization Method for Enrichment Evaluation)**

**📚 История**: Разработан Brans в 1982 году (Бельгия)  
**🧮 Математическая база**: Теория предпочтений и парных сравнений

**Принцип**:
```
Сравнивает каждую альтернативу с каждой другой по каждому критерию  
Использует функции предпочтений для моделирования человеческих предпочтений
```

**Математика**:
```typescript
// Функции предпочтений (6 типов)
enum PreferenceFunction {
  USUAL,           // 0 или 1 (строго лучше/хуже)  
  U_SHAPE,         // Пороговое предпочтение
  V_SHAPE,         // Линейное предпочтение  
  LEVEL,           // Ступенчатое предпочтение
  LINEAR,          // Линейное с порогами
  GAUSSIAN         // Гауссовое предпочтение
}

// Пример U-SHAPE функции предпочтения
function uShapePreference(d: number, threshold: number): number {
  return Math.abs(d) <= threshold ? 0 : 1;
}

// Парные сравнения альтернатив
function calculatePrometheeFlows(matrix: number[][], preferences: PreferenceFunction[]): 
  {positiveFlows: number[], negativeFlows: number[]} {
  
  const n = matrix.length;
  const positiveFlows: number[] = new Array(n).fill(0);
  const negativeFlows: number[] = new Array(n).fill(0);
  
  // Сравниваем каждую альтернативу с каждой другой
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a !== b) {
        // По каждому критерию
        for (let c = 0; c < matrix[0].length; c++) {
          const preference = calculatePreference(
            matrix[a][c] - matrix[b][c], 
            preferences[c]
          );
          positiveFlows[a] += preference;      // Насколько A лучше других
          negativeFlows[b] += preference;      // Насколько B хуже других  
        }
      }
    }
  }
  
  return { positiveFlows, negativeFlows };
}
```

**Когда PROMETHEE лучше**: Сложные предпочтения пользователей, нужно моделировать "порогы безразличия"

#### **4. ELECTRE (ELimination Et Choix Traduisant la REalité)**

**📚 История**: Разработан Roy в 1966 году (Франция) - ПЕРВЫЙ MCDM метод!  
**🧮 Математическая база**: Теория отношений превосходства и нечетких множеств

**Принцип**:
```
Строит отношения превосходства между альтернативами
Использует пороги согласия и несогласия
```

**Математика**:
```typescript
// Отношения превосходства в ELECTRE
function buildOutrankingRelations(matrix: number[][], 
                                  concordanceThreshold: number, 
                                  discordanceThreshold: number): boolean[][] {
  const n = matrix.length;
  const outranking: boolean[][] = Array(n).fill(null).map(() => Array(n).fill(false));
  
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a !== b) {
        // Индекс согласия: доля критериев, по которым A лучше B
        const concordance = calculateConcordance(matrix[a], matrix[b]);
        
        // Индекс несогласия: максимальная разность по критериям где B лучше A  
        const discordance = calculateDiscordance(matrix[a], matrix[b]);
        
        // A превосходит B если: высокое согласие И низкое несогласие
        outranking[a][b] = 
          concordance >= concordanceThreshold && 
          discordance <= discordanceThreshold;
      }
    }
  }
  
  return outranking;
}
```

**Когда ELECTRE лучше**: Много альтернатив, нужна фильтрация неперспективных вариантов

#### **5. AHP (Analytic Hierarchy Process)**

**📚 История**: Разработан Saaty в 1970 году (США)  
**🧮 Математическая база**: Теория собственных векторов и матричная алгебра

**Принцип**:
```
Разбивает сложную проблему на иерархию (цель → критерии → альтернативы)
Использует парные сравнения для определения весов
```

**Математика**:
```typescript
// Шкала Saaty для парных сравнений
const SaatyScale = {
  1: "Равная важность",
  3: "Умеренное предпочтение",  
  5: "Сильное предпочтение",
  7: "Очень сильное предпочтение",
  9: "Экстремальное предпочтение"
};

// Вычисление собственного вектора для весов критериев
function calculateAHPWeights(pairwiseMatrix: number[][]): number[] {
  // Нормализация матрицы
  const normalized = normalizeAHPMatrix(pairwiseMatrix);
  
  // Среднее арифметическое строк = приближение собственного вектора
  const weights = normalized.map(row => 
    row.reduce((sum, val) => sum + val, 0) / row.length
  );
  
  // Проверка консистентности (CR < 0.1)
  const consistency = checkConsistency(pairwiseMatrix, weights);
  
  if (consistency.ratio > 0.1) {
    throw new Error(`Inconsistent judgments: CR=${consistency.ratio}`);
  }
  
  return weights;
}
```

**Когда AHP лучше**: Структурированные задачи с четкой иерархией критериев

### **🎯 Сравнение методов для нашей задачи**

| Метод | **Математическая основа** | **Лучше всего для** | **Для MVP?** |
|-------|---------------------------|---------------------|--------------|
| **TOPSIS** | Евклидово расстояние | Сбалансированные критерии | ✅ **ДА** |
| **Simple Weighted** | Линейная алгебра | Простые задачи | ✅ **ДА** |
| **VIKOR** | Lp-метрика + компромиссы | Противоречивые критерии | ⚠️ Позже |
| **PROMETHEE** | Парные сравнения | Сложные предпочтения | ❌ Overkill |
| **ELECTRE** | Теория превосходства | Фильтрация кандидатов | ❌ Overkill |
| **AHP** | Собственные векторы | Иерархические задачи | ❌ Overkill |

### **🎯 ФИНАЛЬНАЯ РЕКОМЕНДАЦИЯ:**

**Для MVP**: **Simple Weighted Sum** (1-2 часа реализации)  
**После MVP**: **TOPSIS** (когда нужна научная обоснованность)  
**Далеко после MVP**: **VIKOR** (для сложных противоречивых случаев)

**Математическая база есть у всех методов, но сложность реализации кардинально различается!**
