# 🌍 Level 1: Контекст данных WayMates (ОБНОВЛЕНО 2025-09-08)

## 📊 Планируемые типы данных для сбора с пользователей

### **Основные сущности пользовательских данных**

WayMates собирает три ключевых типа данных от пользователей:

1. **Контекст** (обязательный) - текущее состояние пользователя
2. **Путь** (опциональный) - история развития навыков  
3. **Цель** (опциональный) - желаемое состояние

---

## 🎯 **1. КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (UserContext)**

### **Основная информация**
```typescript
interface UserContext {
  id: string;                         // Уникальный ID контекста
  userId: string;                     // ID пользователя
  version: number;                    // Версия контекста
  isCurrent: boolean;                 // Текущий ли это контекст
  currentSituation: string;           // Текстовое описание текущей роли/позиции
  constraints: UserConstraints;       // Ограничения пользователя
  goals: string[];                    // Список целей
  careerAxis: CareerAxisAnalysis;     // Анализ по трем осям карьеры
  skills: UserSkills;                 // Навыки и компетенции пользователя
  changeReason: string;               // Причина изменения контекста
  createdAt: Date;
  updatedAt: Date;
}
```

### **Ограничения пользователя**
```typescript
interface UserConstraints {
  budget: number;                     // Бюджет на обучение (руб/месяц)
  timeline: number;                   // Желаемый срок достижения цели (месяцы)
  family: boolean;                    // Есть ли семья/дети
  education: boolean;                 // Нужно ли формальное образование
  location: string;                   // Текущее местоположение
  workSchedule: 'full-time' | 'part-time' | 'flexible';
  learningStyle: 'self-paced' | 'structured' | 'mentored';
}
```

### **Анализ карьерных осей**
```typescript
interface CareerAxisAnalysis {
  width: number;                      // Рост по ширине (% освоенных доменов)
  depth: number;                      // Рост по глубине (уровень экспертизы)
  vertical: number;                   // Рост по вертикали (размер команды)
  recommendedAxis: 'width' | 'depth' | 'vertical' | 'choice';
  currentRole: string;                // Текущая роль
  experienceYears: number;            // Общий опыт работы
}
```

### **Навыки и компетенции**
```typescript
interface UserSkills {
  technicalSkills: SkillLevel[];      // Технические навыки
  softSkills: SkillLevel[];          // Мягкие навыки
  languages: LanguageLevel[];        // Языки программирования
  frameworks: FrameworkLevel[];      // Фреймворки и библиотеки
  methodologies: MethodologyLevel[]; // Методологии работы
}

interface SkillLevel {
  skillId: string;                    // ESCO ID навыка
  skillName: string;                  // Название навыка
  level: 1 | 2 | 3 | 4 | 5;          // Уровень владения (1-5)
  yearsExperience: number;            // Годы опыта
  lastUsed: Date;                     // Когда последний раз использовался
  confidence: number;                 // Уверенность в навыке (0-100%)
}
```

### **Версионирование контекстов**
```typescript
interface ContextVersioning {
  userId: string;
  contexts: UserContext[];            // Все версии контекстов пользователя
  currentContextId: string;           // ID текущего контекста
  contextHistory: ContextChange[];    // История изменений
}

interface ContextChange {
  fromContextId: string;              // Предыдущий контекст
  toContextId: string;                // Новый контекст
  changeType: 'skills_update' | 'role_change' | 'goal_update' | 'constraints_update';
  changeDescription: string;          // Описание изменений
  changedAt: Date;
  triggeredBy: 'user' | 'system' | 'achievement'; // Кто инициировал изменение
}
```

**Причины создания новой версии контекста:**
- Изучение нового навыка
- Смена роли/позиции
- Изменение целей
- Обновление ограничений (бюджет, время)
- Достижение промежуточной цели
- Системные рекомендации

---

## 🛣️ **2. ПУТЬ РАЗВИТИЯ (UserPath)**

### **История карьерного развития**
```typescript
interface UserPath {
  userId: string;
  careerTransitions: CareerTransition[];
  learningJourneys: LearningJourney[];
  achievements: Achievement[];
  createdAt: Date;
  updatedAt: Date;
}

interface CareerTransition {
  fromRole: string;                   // Предыдущая роль
  toRole: string;                     // Новая роль
  company: string;                    // Компания
  startDate: Date;                    // Дата начала
  endDate?: Date;                     // Дата окончания (если завершена)
  monthsDuration: number;             // Продолжительность в месяцах
  keySkillsLearned: string[];         // Ключевые навыки, изученные
  axis: 'width' | 'depth' | 'vertical'; // Ось роста
  success: boolean;                   // Успешность перехода
  satisfaction: number;               // Удовлетворенность (1-10)
  salaryChange: number;               // Изменение зарплаты (%)
}
```

### **Истории обучения**
```typescript
interface LearningJourney {
  skillId: string;                    // ESCO ID навыка
  skillName: string;                  // Название навыка
  startDate: Date;                    // Дата начала изучения
  endDate?: Date;                     // Дата завершения
  hoursSpent: number;                 // Часов потрачено
  learningMethod: 'course' | 'project' | 'mentoring' | 'self-study';
  resources: string[];                // Использованные ресурсы
  cost: number;                       // Стоимость обучения
  success: boolean;                   // Успешность изучения
  difficulty: 1 | 2 | 3 | 4 | 5;     // Сложность (1-5)
  prerequisites: string[];            // Предварительные навыки
}
```

### **Достижения и артефакты**
```typescript
interface Achievement {
  id: string;
  title: string;                      // Название достижения
  description: string;                // Описание
  type: 'certification' | 'project' | 'award' | 'publication';
  date: Date;                         // Дата получения
  issuer: string;                     // Кто выдал
  skills: string[];                   // Связанные навыки
  evidence: string[];                 // Ссылки на доказательства
  verified: boolean;                  // Проверено ли
}
```

---

## 🎯 **3. ЦЕЛЬ ПОЛЬЗОВАТЕЛЯ (UserGoal)**

### **Целевое состояние**
```typescript
interface UserGoal {
  userId: string;
  targetRole: string;                 // Целевая роль
  targetContext: TargetContext;       // Целевой контекст
  motivation: string;                 // Мотивация
  priority: 'high' | 'medium' | 'low'; // Приоритет
  deadline?: Date;                    // Желаемый срок
  alternatives: string[];             // Альтернативные цели
  createdAt: Date;
  updatedAt: Date;
}

interface TargetContext {
  requiredSkills: SkillRequirement[]; // Требуемые навыки
  preferredSkills: SkillRequirement[]; // Желательные навыки
  experienceLevel: 'junior' | 'middle' | 'senior' | 'lead' | 'expert';
  industry: string;                   // Отрасль
  companySize: 'startup' | 'mid' | 'enterprise';
  location: string;                   // Желаемое местоположение
  salaryExpectation: number;          // Ожидаемая зарплата
  workType: 'remote' | 'hybrid' | 'office';
}

interface SkillRequirement {
  skillId: string;                    // ESCO ID навыка
  skillName: string;                  // Название навыка
  requiredLevel: 1 | 2 | 3 | 4 | 5;  // Требуемый уровень
  isCritical: boolean;                // Критично ли для роли
  yearsExperience?: number;           // Требуемый опыт
}
```

---

## 📊 **4. ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ**

### **Активный контекст (готовность к обучению)**
```typescript
interface ActiveContext {
  userId: string;
  timePerWeek: number;                // Часов в неделю на обучение
  budgetPerMonth: number;             // Бюджет в месяц на обучение
  preferredLearningTime: 'morning' | 'afternoon' | 'evening' | 'weekend';
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  motivationLevel: 1 | 2 | 3 | 4 | 5; // Уровень мотивации
  riskTolerance: 'low' | 'medium' | 'high';
  stabilityPreference: 'stable' | 'flexible' | 'adventurous';
}
```

### **Метаданные профиля**
```typescript
interface UserProfile {
  userId: string;
  personalInfo: {
    age: number;
    gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
    education: 'high-school' | 'bachelor' | 'master' | 'phd' | 'other';
    location: string;
    timezone: string;
  };
  preferences: {
    language: 'ru' | 'en';
    notifications: boolean;
    dataSharing: boolean;
    marketing: boolean;
  };
  systemData: {
    userFactor: number;               // Персональный множитель скорости
    lastActive: Date;
    totalSessions: number;
    completedGoals: number;
  };
}
```

---

## 🔄 **5. ПРОЦЕСС СБОРА ДАННЫХ**

### **Этап 1: Первичный сбор контекста**
- Текстовое описание текущей роли
- Список основных навыков
- Ограничения (время, бюджет, семья)
- Целевая роль

### **Этап 2: Детализация навыков**
- Оценка уровня владения навыками
- История изучения навыков
- Достижения и сертификаты
- Предпочтения в обучении

### **Этап 3: Уточнение целей**
- Детальное описание целевой роли
- Требования к навыкам
- Альтернативные варианты
- Временные рамки

### **Этап 4: Постоянное обновление**
- Отслеживание прогресса обучения
- Обновление навыков
- Новые достижения
- Изменение целей

---

## 🎯 **КЛЮЧЕВЫЕ ПРИНЦИПЫ СБОРА ДАННЫХ**

### **1. Поэтапный сбор**
- **Минимум для старта**: контекст + цель
- **Детализация**: навыки + история + ограничения
- **Постоянное обновление**: прогресс + новые цели

### **2. ESCO интеграция**
- Все навыки привязаны к ESCO ID
- Стандартизированные уровни владения (1-5)
- Иерархия и зависимости навыков

### **3. Три оси карьеры**
- **Width** - ширина (процент освоенных доменов)
- **Depth** - глубина (уровень экспертизы)
- **Vertical** - вертикаль (размер команды)

### **4. Персонализация**
- UserFactor для адаптации прогнозов
- Активный контекст для оптимизации маршрутов
- Предпочтения в обучении

---

## 📊 **ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ ДАННЫХ**

### **Поиск аватаров**
```typescript
// Найти пользователей с похожим контекстом и той же целью
const currentContext = await getCurrentUserContext(userId);
const avatars = await findAvatars({
  userContext: currentContext,
  targetRole: "Senior Developer"
});

// Или найти аватаров на основе конкретной версии контекста
const contextVersion = await getUserContext(userId, contextId);
const avatars = await findAvatars({
  userContext: contextVersion,
  targetRole: "Senior Developer"
});
```

### **Версионирование контекста**
```typescript
// Создать новую версию контекста при изменении навыков
const newContext = await createContextVersion({
  userId: "user123",
  previousContextId: "ctx_v5",
  changes: {
    skills: {
      technicalSkills: [
        { skillId: "react", skillName: "React", level: 5, yearsExperience: 2.5 }
      ]
    }
  },
  changeReason: "Изучил React Advanced",
  triggeredBy: "user"
});

// Получить историю изменений контекста
const contextHistory = await getContextHistory(userId);
```

### **Формирование целевого контекста**
```typescript
// Создать целевой контекст на основе аватаров
const targetContext = await buildTargetContext({
  avatars: similarUsers,
  requiredSkills: ["System Design", "Leadership", "Architecture"],
  experienceLevel: "senior"
});
```

### **Прогноз времени обучения**
```typescript
// Рассчитать время изучения навыка
const timePrediction = await predictLearningTime({
  skillId: "react-advanced",
  userFactor: 1.2,
  tempoBucket: "intensive_5h_week",
  paradigm: "new_paradigm"
});
```