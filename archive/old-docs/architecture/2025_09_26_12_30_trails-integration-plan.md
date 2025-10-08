# WayMates: План интеграции троп (Trails)

Дата: 2025-09-26

## Принятые утверждения

### Архитектура запросов цели

- **4 варианта запроса цели пользователем:**
  1. **Составленный профиль + целевой контекст** - основной кейс, готовимся к нему
  2. **Составленный профиль без цели** - помогаем сформулировать цель через поиск + примерка
  3. **Без профиля, но с целевым контекстом** - примерка под цель
  4. **Без профиля и без цели** - статистика и обзор возможностей
- Flow: поиск когорты по текущему профилю → поиск аватаров по близости к целевому контексту → получение ID пользователя и пары контекстов (from/to) → запрос всех троп между этими контекстами.
- Схема троп: используем структуру из`schemas.md` (trail_id, skill, platform, user_id, duration, schedule, cost, ratings).
- Тропы выдаем "как есть" в контекст AI для будущего анализа (пока без аналитики).

### Алгоритм поиска аватара

- Поиск аватара: по близости к**целевому** контексту (не текущему, как при поиске когорты).
- Переиспользуем принципы текущего алгоритма поиска когорты (типы, scoring), но с другими весами и имплементацией для avatar matching.
- Отдельная scoring функция для avatar matching нужна.

### Данные и генерация

- Актуализация данных: через AI промпт (дополняем существующие или создаем новые контексты). Отдельная задача в другом чате.
- Тропы на контекст: 1-3 тропы на каждое межконтекстное пространство (переходы между контекстами).
- Количество смен контекстов: от 1 до 2-3 на пользователя.

### ✅ Neo4j схема [РЕШЕНО]

- **Структура троп:** `(Context1)-[:STEPS_ON]->(Trail)-[:DEVELOPS]->(SkillPlatformNode)-[:ON_PLATFORM]->(Platform)`
- **Связь контекстов:** `(Trail)-[:STEPS_TO]->(Context2)` - тропы как пути, по которым делают шаги между контекстами
- **Аналитика:** Общие `SkillPlatformNode` для статистики эффективности троп по переходам между grade/role
- **Новые Cypher запросы:** path finding между контекстами + аналитика троп по skill+platform

### Scope

- MVP: начинаем с простого - "найти аватара с target context" + "показать его тропы".
- Тестирование: расширяем текущий`test_plan.md` (не создаем отдельный).

## Открытые вопросы

### Neo4j схема и индексы

- **Q1 [✅ РЕШЕНО]**: Схема связи троп с контекстами:
  ```cypher
  // ✅ ФИНАЛЬНАЯ СХЕМА: Метафора шагов по тропе + Общие SkillPlatformNode
  (Context1)-[:STEPS_ON]->(Trail {user_id, trail_id})
  (Trail)-[:DEVELOPS]->(SkillPlatformNode {skill: "typescript", platform: "udemy"})
  (Trail)-[:STEPS_TO]->(Context2)
  
  // Аналитика эффективности троп:
  // "По тропе TypeScript на Udemy прошли 15 Junior'ов до Middle"
  MATCH (spn:SkillPlatformNode {skill: "typescript", platform: "udemy"})
  MATCH (t:Trail)-[:DEVELOPS]->(spn)
  MATCH (from:Context)-[:STEPS_ON]->(t)-[:STEPS_TO]->(to:Context)
  RETURN from.grade as from_grade, to.grade as to_grade, count(*) as transitions
  ```
- **Q2**: Какие индексы создать для троп:
  - На`trail_id` (уникальный)
  - На`skill + platform` композитный
  - На`user_id` в Context для поиска контекстов пользователя
  - Составные индексы на тропы НЕ НУЖНЫ - запросы через граф пользователя (User → Context → Trail)

### ✅ Схема целевого контекста и ограничений [РЕШЕНО]

- **Q3 [✅ РЕШЕНО]**: TypeBox схема для`TargetGoal`:
  ```typescript
  // ✅ ФИНАЛЬНАЯ СХЕМА - упрощенная без enum'ов
  interface TargetGoal extends Partial<ContextInput> {
    constraints?: UserConstraints;
  }
  
  interface UserConstraints {
    max_hours_per_week?: number;
    max_monthly_budget?: number;
    deadline_date?: string; // ISO формат: "YYYY-MM-DD"
  }
  ```
- **Q4 [✅ РЕШЕНО]**: Структура запросов:
  - **Решение:** Расширяем существующую `QueryInput + target_goal?: TargetGoal`
  - Добавить запрос истории: по `user_id` + `from_context_id` + `to_context_id`
  - Простота и KISS принцип

### ✅ Алгоритм avatar matching [РЕШЕНО]

- **Q5 [✅ РЕШЕНО]**: Scoring подход - **упрощенный через веса (как в когорте):**
  ```typescript
  interface TrailScoringInput {
    matchedSkills: number;        // Совпадение навыков
    platformRating: number;      // Рейтинг платформы
    costCompatibility: number;   // Соответствие бюджету
    timelineCompatibility: number; // Соответствие времени
  }
  
  const TRAIL_WEIGHTS = {
    matchedSkills: 0.4,
    platformRating: 0.2,
    costCompatibility: 0.2,
    timelineCompatibility: 0.2
  };
  ```
- **Q6 [✅ РЕШЕНО]**: Критерий выбора - **единый scoring без категорий:**
  - Один общий скор для всех аватаров
  - Фильтрация по constraints (время, бюджет, deadline)
  - Сортировка по убыванию trailScore
  - **Векторизация отложена** - нарушает правило Парето для MVP

### ✅ Данные и тестирование [РЕШЕНО]

- **Q7 [✅ РЕШЕНО]**: Актуализация контекстов:
  - **Выбран подход:** Создать новые 50+ контекстов с тропами через AI промпт
  - **Альтернатива:** Обновить существующие 100 контекстов тем же способом
  - **Решение:** Избегать legacy (100 старых + 50 новых), нужна унификация
- **Q8 [✅ РЕШЕНО]**: Фикстуры для тестов:
  - **Подход:** Использовать актуальные контексты из основной базы
  - **Минимальный набор:** 3-5 контекстов с тропами для integration тестов
  - **Full dataset:** вся база для E2E тестов

## План действий

### Этап 1: Схемы и типы (TypeBox)

1. **Схема Trail**: Добавить в`schemas.ts` TypeBox схему для`Trail` на основе`schemas.md`.
2. **✅ Схема TargetGoal**: `TargetGoal = Partial<ContextInput> + UserConstraints` - РЕШЕНО.
3. **✅ UserConstraints**: Упрощенная схема без enum'ов - РЕШЕНО.
4. **Расширить QueryFile**: Интегрировать target_goal и constraints (Q4).
5. **✅ Neo4j схема**: `(Context)-[:STEPS_ON]->(Trail)-[:DEVELOPS]->(SkillPlatformNode)` - РЕШЕНО.

### Этап 2: Database layer

6. **Обновить init.cypher**: Добавить constraints и индексы для троп с новыми связями `STEPS_ON/STEPS_TO`.
7. **Новые Cypher запросы**:
   - `UPSERT_TRAIL_CYPHER` - создание/обновление троп
   - `QUERY_AVATAR_CYPHER` - поиск аватара по target_goal + constraints
   - `PATH_TRAILS_CYPHER` - поиск троп между контекстами
8. **Обновить persist.ts**: Добавить импорт троп при загрузке контекстов.

### Этап 3: Алгоритм поиска

9. **✅ Trail scoring**: Создать `TrailScoringInput` + `TRAIL_WEIGHTS` - РЕШЕНО.
10. **Обновить search_cohort_simple.ts**:
    - Добавить`findAvatar()` функцию с constraints фильтрацией
    - Добавить`getTrailPath()` функцию
    - Интегрировать упрощенный scoring без категорий
11. **Trail path building**: Логика построения пути троп от current к target через аватара.

### Этап 4: Данные и тестирование

12. **AI промпт для троп**: Создать промпт для генерации троп к существующим контекстам.
13. **Генерация данных**: Создать 50+ новых контекстов с тропами через AI. но в отдельной задаче и чате
14. **Расширить test_plan.md**: Добавить тесты для троп:
    - Unit: trail scoring (упрощенный), path building
    - Integration: avatar finding с constraints, trail queries
    - E2E: full flow с target_goal + constraints

### Этап 5: Финализация

15. **Документация**: Обновить архитектурную документацию с упрощенным flow.
16. **Валидация**: E2E тесты на полном датасете с тропами.
17. **Post-MVP**: Векторизация маршрутов для семантического поиска.

## Активный контекст пользователя

### Ограничения и ресурсы пользователя

- **Пассивный контекст:** навыки и достижения пользователя (что уже есть)
- **Активный контекст:** ресурсы для развития (что готов вложить):
  - **Временные ограничения:** часы/день, дни/неделю на саморазвитие
  - **Бюджетные лимиты:** 
    - Обязательные платежи (экзамены, визы) vs
    - Бустеры (частные занятия, VIP-режимы, менторы)
  - **Временные рамки:** абсолютная дата deadline для достижения цели ("2026-03-01")
  - **Темп развития:** интенсивный vs размеренный

### Интеграция в поиск аватаров
- **Фильтрация аватаров:** отсекать по constraints (время, бюджет, deadline)
- **Scoring троп:** единый подход через веса без категорий
- **Простота:** constraints покрывают 90% случаев, enum'ы не нужны
- **MVP фокус:** граф + AI нормализация, векторизация отложена

### Вопросы интеграции
- **Q9 [✅ РЕШЕНО]**: Структура схемы с ограничениями:
  ```typescript
  interface TargetGoal extends Partial<ContextInput> {
    constraints?: UserConstraints;
  }
  
  interface UserConstraints {
    max_hours_per_week?: number;
    max_monthly_budget?: number;
    deadline_date?: string; // ISO формат: "YYYY-MM-DD"
  }
  ```
- **Q10 [✅ РЕШЕНО]**: Timing применения ограничений:
  ```typescript
  // ✅ ВЫБРАННЫЙ ПОДХОД: Простой массив с score
  // Ищем аватаров → считаем score → сортируем по убыванию
  [
    {avatar: avatar1, score: 0.95},
    {avatar: avatar2, score: 0.87}, 
    {avatar: avatar3, score: 0.72}
  ]
  // Никаких категорий - пользователь сам решает где граница
  ```

## Векторизация маршрутов [ОТЛОЖЕНО]

**Статус:** Отложено до post-MVP

**Причины:**
- Граф + AI нормализация покрывают 80% потребностей
- Векторизация добавляет 80% сложности для 20% пользы
- Нарушает правило Парето для MVP
- Сначала докажи ценность на структурированных данных

## Статус приоритетов

- **🟢 Решено**: Neo4j схема троп (Q1), TargetGoal + ограничения (Q3, Q9, Q10), данные и тестирование (Q7, Q8), алгоритм avatar matching (Q5, Q6)
- **⏳ Отложено**: Векторизация маршрутов - после MVP и user feedback

**🚀 ГОТОВНОСТЬ К РАЗРАБОТКЕ: 100%** - все архитектурные решения приняты, детали реализации определены!

---

## 🆕 **ФИНАЛЬНЫЕ УТОЧНЕНИЯ (актуализация)**

### 🎯 **Окончательные технические решения:**

1. **Двухэтапный поиск аватаров:**
   - ✅ Этап 1: `searchCohort(queryInput)` - УЖЕ РЕАЛИЗОВАН
   - 🆕 Этап 2: `findAvatarWithTrails(cohortUserIds, targetGoal)` - ДОБАВЛЯЕМ

2. **Конкретные формулы расчета совместимости:**
   ```typescript
   costCompatibility = Math.min(1, constraints.max_monthly_budget / trail.cost_usd)
   timelineCompatibility = Math.min(1, constraints.max_hours_per_week / trail.hours_per_week)
   ```

3. **Простой массив результатов без дублирования:**
   ```typescript
   // ✅ ФИНАЛЬНЫЙ ФОРМАТ
   [{avatar: avatar1, score: 0.95}, {avatar: avatar2, score: 0.87}]
   // ❌ НЕ ДУБЛИРУЕМ compatibility поле
   ```

4. **Поиск через граф пользователя (без составных индексов):**
   ```cypher
   // Запросы только внутри профиля пользователя
   MATCH (avatar:User {user_id: $cohort_user_id})-[:HAS_CONTEXT]->(from_ctx:Context)
   -[:STEPS_ON]->(trail:Trail)-[:STEPS_TO]->(to_ctx:Context)
   ```

5. **Фильтрация constraints на уровне Cypher:**
   ```cypher
   WHERE ($max_budget IS NULL OR trail.cost_usd <= $max_budget)
   AND ($max_hours IS NULL OR trail.hours_per_week <= $max_hours)
   ```

### 📋 **Готовые компоненты для реализации:**
- ✅ Поиск когорты (searchCohort)
- 🆕 QUERY_AVATAR_CYPHER запрос  
- 🆕 TrailScoringInput с конкретными формулами
- 🆕 findAvatarWithTrails() функция
- 🆕 Простой scoring без категорий
