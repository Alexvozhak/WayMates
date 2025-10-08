# WayMates Career Intelligence - Current Progress & Testing Plan

## 📊 ТЕКУЩИЙ СТАТУС (09.09.2025)

### ✅ ЗАВЕРШЕНО (Phase 1 - Foundation)
- **Database Architecture**: PostgreSQL + ClickHouse + Redis schemas готовы
- **Docker Infrastructure**: Multi-container setup с всеми сервисами
- **NestJS Application**: Core modules, services, configuration
- **Skill Saturation Algorithm**: Полная математическая реализация
- **API Foundation**: Controllers, DTOs, Swagger documentation

### 🔧 В РАБОТЕ (Phase 1A - Goal-Driven Testing)
- Goal-driven API (добавить user goal в анализ)
- Source attribution (откуда система взяла данные)
- Test users library (JSON с реальными профилями)

### ❌ ОТСУТСТВУЕТ
- **Goal vs Recommendation comparison**: Система не сравнивает желаемое с рекомендуемым
- **BGE-m3 + Vector similarity**: Real embeddings integration
- **Apache AGE Graph queries**: ESCO skills dependencies
- **Test scenarios**: Холодный/теплый/горячий старт

---

## 🧪 ПРИНЦИПЫ ТЕСТИРОВАНИЯ

### **"Trust the AI, Test the Logic" Philosophy**

#### ✅ LIGHTRAG-ЦЕНТРИЧНОЕ ТЕСТИРОВАНИЕ:
- **Все через LightRAG HTTP API**: НЕ прямые запросы к PostgreSQL/ClickHouse
- **Hybrid Vector+Graph**: LightRAG объединяет pgvector + Apache AGE
- **Структурированные JSON-ответы**: LightRAG возвращает парсабельный JSON
- **Source Attribution**: ID-based трассировка конкретных профилей

#### ✅ REAL INTEGRATION TESTING - НЕ МОКИ:
- **BGE-m3 Embeddings**: Доверяемся ML модели, НЕ задаем mock векторы
- **Cosine Similarity**: Система САМА находит похожих пользователей через LightRAG
- **Apache AGE Graph**: Реальные ESCO dependencies через LightRAG
- **End-to-End Pipeline**: User Context → LightRAG → Career Analysis

#### ✅ ТРЕХУРОВНЕВОЕ ТЕСТИРОВАНИЕ КАЧЕСТВА:
1. **Case 1 - Чистый сигнал**: Аватар среди релевантных аватаров
2. **Case 2 - Чистый шум**: Аватар среди неподходящих аватаров  
3. **Case 3 - Сигнал среди шума**: Система отсеивает нерелевантные профили

#### ✅ SOURCE ATTRIBUTION (три типа):
- **user**: Собственная история пользователя
- **cohort_memory**: Воспоминания похожих людей (recalled experiences)
- **cohort_live**: Отслеженные данные похожих людей (verified events)

#### ✅ ДИНАМИЧЕСКИЙ ЭТАЛОН - КЛЮЧЕВАЯ ОСОБЕННОСТЬ:
- **Эталон строится из текущей когорты**: Нет фиксированных benchmarks
- **Контекстно-зависимые рекомендации**: Тот же пользователь получает разные советы в разных когортах
- **Тестируем эволюцию эталона**: Как изменение состава когорты влияет на benchmark
- **Манипуляция контекстом**: В тестах меняем когорту и видим изменение рекомендаций
- **Benchmark stability**: Устойчивость эталона к выбросам и новым пользователям

---

## 🎯 ПЛАН ДАЛЬНЕЙШИХ ДЕЙСТВИЙ

### **Phase 1A: LightRAG Search Validation (текущий этап)**
**ЦЕЛЬ**: Проверить что LightRAG правильно находит похожие профили для двух типов анализа

#### **🔍 АРХИТЕКТУРНОЕ РАЗДЕЛЕНИЕ:**
- **LightRAG = Поисковик**: Находит похожие профили для Internal/External анализа
- **Internal Growth Analyzer = 4-осевая модель**: Анализ развития внутри компании
- **External Growth Analyzer = Динамический эталон**: Рыночное позиционирование
- **AI НЕ принимает решения**, только ищет данные для наших математических алгоритмов

1. **LightRAG Search Testing - Internal vs External Cohorts**:
   ```typescript
   // ✅ Тестируем поиск для Internal Growth (похожие условия развития)
   test('finds internal growth cohort', async () => {
     const user = {
       skills: ['React'], 
       company_type: 'startup',
       team_size: 8,
       role_level: 'middle'
     };
     
     const internalResults = await lightrag.findSimilar(user, {
       analysis_type: 'internal_growth',
       filters: ['company_type', 'team_size', 'role_level', 'tech_stack']
     });
     
     // Проверяем что найдены люди в похожих условиях
     expect(internalResults.profiles[0].company_type).toBe('startup');
     expect(internalResults.profiles[0].team_size).toBeLessThanOrEqual(15);
     expect(internalResults.profiles[0].similarity).toBeGreaterThan(0.7);
   });
   
   // ✅ Тестируем поиск для External Growth (рыночное позиционирование)
   test('finds external growth cohort', async () => {
     const user = {
       skills: ['React'], 
       role_level: 'middle',
       experience_years: 3,
       location: 'Moscow'
     };
     
     const externalResults = await lightrag.findSimilar(user, {
       analysis_type: 'external_growth',
       filters: ['role_level', 'tech_stack', 'experience_years', 'location']
       // НЕ фильтруем по company_type - берем ВЕСЬ рынок
     });
     
     // Проверяем разнообразие компаний в результатах
     const companyTypes = externalResults.profiles.map(p => p.company_type);
     expect(companyTypes).toContain('startup');
     expect(companyTypes).toContain('enterprise');
     expect(companyTypes).toContain('bigtech');
   });
   ```

2. **Cohort Data Structure - Internal vs External**:
   ```json
   // tests/data/cohorts.json - метаданные групп для двух типов анализа
   {
     "internal_startup_developers": {
       "members": ["user_12345", "user_67890", "user_11111"],
       "context": "Fast-paced startups, rapid growth",
       "analysis_type": "internal_growth",
       "filters": ["company_type", "team_size", "role_level", "tech_stack"]
     },
     "external_react_middle": {
       "members": ["user_12345", "user_67890", "user_11111", "user_22222", "user_33333"],
       "context": "React Middle developers across all company types",
       "analysis_type": "external_growth", 
       "filters": ["role_level", "tech_stack", "experience_years", "location"]
     }
   }
   
   // tests/data/avatars.json - детальные профили с 4-осевыми данными
   {
     "user_12345": {
       "id": "user_12345",
       "display_name": "startup-jack",
       "source_type": "cohort_memory",
       "skills": ["React", "Leadership"],
       "career_path": [...],
       "salary_history": [70000, 85000, 130000],
       "internal_growth": {
         "axis_1_breadth": 7,        // Широта: освоение новых доменов
         "axis_2_depth": 8,          // Глубина: решение сложных задач
         "axis_3_peer_leadership": 6, // Неформальное лидерство
         "axis_4_formal_leadership": 2 // Официальная ответственность
       },
       "external_growth": {
         "salary_current": 130000,
         "role_level": "senior",
         "market_segment": "startup",
         "location": "Moscow"
       }
     }
   }
   ```

3. **Three-Level Search Quality Testing - Dual Analysis**:
   ```typescript
   // Case 1: Pure Signal - релевантные когорты для каждого типа анализа
   await cohortManager.configureCohorts({
     internal: ['internal_startup_developers'],
     external: ['external_react_middle']
   }); 
   
   // Case 2: Pure Noise - нерелевантные когорты
   await cohortManager.configureCohorts({
     internal: ['internal_enterprise_developers'], // Другая среда
     external: ['external_python_developers']      // Другой стек
   });
   
   // Case 3: Signal + Noise - система отсеивает неподходящие
   await cohortManager.configureCohorts({
     internal: ['internal_startup_developers', 'internal_enterprise_developers'],
     external: ['external_react_middle', 'external_python_developers']
   });
   
   // Проверяем что Internal анализ фокусируется на условиях развития
   const internalAnalysis = await internalGrowthAnalyzer.analyze(user, internalCohort);
   expect(internalAnalysis.cohort_context).toContain('startup');
   
   // Проверяем что External анализ фокусируется на рыночной позиции
   const externalAnalysis = await externalGrowthAnalyzer.analyze(user, externalCohort);
   expect(externalAnalysis.market_diversity).toBeGreaterThan(2); // Разные типы компаний
   ```

### **Phase 1B: Dual Analytical Algorithms Development**
**ЦЕЛЬ**: Разработать два типа анализа - Internal Growth (4-осевая) и External Growth (динамический эталон)

1. **Internal Growth Analyzer - 4-осевая модель**:
   ```typescript
   // ✅ НАША математика для анализа развития внутри компании
   export class InternalGrowthAnalyzer {
     analyze(userProfile: any, similarProfiles: any[], avatar: any) {
       const currentAxes = this.calculateCurrentAxes(userProfile);
       const cohortAxes = this.calculateCohortAxes(similarProfiles);
       const avatarAxes = this.calculateAvatarAxes(avatar, userProfile.months_in_company);
       
       return {
         user_axes: currentAxes,           // [axis_1, axis_2, axis_3, axis_4]
         cohort_range: cohortAxes,         // {min: [1,2,1,0], max: [8,9,7,4]}
         avatar_axes: avatarAxes,          // Ожидаемые значения аватара
         recommendations: this.generateInternalRecommendations(currentAxes, cohortAxes, avatarAxes),
         growth_velocity: this.calculateGrowthVelocity(userProfile.growth_history)
       };
     }
     
     calculateCurrentAxes(profile: any) {
       return {
         axis_1_breadth: this.analyzeDomainBreadth(profile.technologies_used),
         axis_2_depth: this.analyzeTaskComplexity(profile.completed_tasks),
         axis_3_peer_leadership: this.analyzeMentoringActivity(profile.help_events),
         axis_4_formal_leadership: this.analyzeOfficialResponsibility(profile.roles)
       };
     }
   }
   ```

2. **External Growth Analyzer - Динамический эталон**:
   ```typescript
   // ✅ НАША математика для рыночного позиционирования
   export class ExternalGrowthAnalyzer {
     analyze(userProfile: any, marketCohort: any[]) {
       const marketBenchmark = this.buildDynamicBenchmark(marketCohort);
       const userPosition = this.calculateMarketPosition(userProfile, marketBenchmark);
       
       return {
         salary_percentile: userPosition.salary_percentile,
         role_progression: userPosition.role_progression,
         skill_market_fit: userPosition.skill_coverage,
         market_segment_context: userPosition.dominant_segments,
         recommendations: this.generateExternalRecommendations(userPosition, marketBenchmark)
       };
     }
     
     buildDynamicBenchmark(cohort: any[]) {
       return {
         salary_range: this.calculateSalaryRange(cohort),
         role_distribution: this.analyzeRoleDistribution(cohort),
         skill_coverage: this.analyzeSkillCoverage(cohort),
         progression_speed: this.calculateProgressionSpeed(cohort)
       };
     }
   }
   ```

2. **Internal Growth Algorithm Unit Testing - 4-осевая модель**:
   ```typescript
   // ✅ Тестируем каждую ось отдельно с mock-данными
   
   // ОСЬ 1: Доменная широта (Individual)
   test('analyzes domain breadth correctly', () => {
     const userProfile = {
       technologies_used: ['React', 'Node.js', 'Docker'], // 3 домена
       completed_tasks: [
         {domain: 'frontend', complexity: 'medium'},
         {domain: 'backend', complexity: 'medium'},
         {domain: 'devops', complexity: 'low'}
       ]
     };
     
     const mockCohort = [
       {axis_1_breadth: 5, months_in_company: 12},
       {axis_1_breadth: 7, months_in_company: 12},
       {axis_1_breadth: 6, months_in_company: 12}
     ];
     
     const result = internalAnalyzer.analyze(userProfile, mockCohort, mockAvatar);
     expect(result.user_axes.axis_1_breadth).toBe(3); // 3 освоенных домена
     expect(result.cohort_range.axis_1_breadth).toEqual({min: 5, max: 7, median: 6});
     expect(result.recommendations.axis_1).toContain('Изучи новый домен');
   });
   
   // ОСЬ 2: Доменная глубина (Individual)
   test('analyzes task complexity depth correctly', () => {
     const userProfile = {
       completed_tasks: [
         {complexity: 'above_grade', story_points: 8}, // Senior-задача
         {complexity: 'above_grade', story_points: 13}, // Senior-задача
         {complexity: 'routine', story_points: 3}       // Middle-задача
       ],
       role_level: 'middle'
     };
     
     const mockCohort = [
       {axis_2_depth: 4, months_in_company: 12},
       {axis_2_depth: 6, months_in_company: 12},
       {axis_2_depth: 5, months_in_company: 12}
     ];
     
     const result = internalAnalyzer.analyze(userProfile, mockCohort, mockAvatar);
     expect(result.user_axes.axis_2_depth).toBe(6); // 2 Senior-задачи из 3
     expect(result.recommendations.axis_2).toContain('Продолжай брать сложные задачи');
   });
   
   // ОСЬ 3: Неформальное лидерство (Shared)
   test('analyzes peer leadership correctly', () => {
     const userProfile = {
       help_events: [
         {type: 'detailed_help', duration_hours: 2, recipient: 'junior_dev'},
         {type: 'mentoring', duration_hours: 4, recipient: 'new_hire'},
         {type: 'quick_answer', duration_hours: 0.5, recipient: 'colleague'}
       ]
     };
     
     const mockCohort = [
       {axis_3_peer_leadership: 3, months_in_company: 12},
       {axis_3_peer_leadership: 5, months_in_company: 12},
       {axis_3_peer_leadership: 4, months_in_company: 12}
     ];
     
     const result = internalAnalyzer.analyze(userProfile, mockCohort, mockAvatar);
     expect(result.user_axes.axis_3_peer_leadership).toBe(6); // 2x + 3x + 1x = 6
     expect(result.recommendations.axis_3).toContain('Отличное менторство');
   });
   
   // ОСЬ 4: Формальная ответственность (Official)
   test('analyzes formal leadership correctly', () => {
     const userProfile = {
       roles: [
         {type: 'temporary_lead', project: 'feature_x', duration_weeks: 4},
         {type: 'official_lead', project: 'migration', duration_weeks: 8}
       ]
     };
     
     const mockCohort = [
       {axis_4_formal_leadership: 1, months_in_company: 12},
       {axis_4_formal_leadership: 3, months_in_company: 12},
       {axis_4_formal_leadership: 2, months_in_company: 12}
     ];
     
     const result = internalAnalyzer.analyze(userProfile, mockCohort, mockAvatar);
     expect(result.user_axes.axis_4_formal_leadership).toBe(3); // temporary + official
     expect(result.recommendations.axis_4).toContain('Готов к Team Lead роли');
   });
   
   // ИНТЕГРАЛЬНЫЙ ТЕСТ: Все 4 оси вместе
   test('analyzes complete internal growth profile', () => {
     const userProfile = {
       technologies_used: ['React', 'Node.js'],
       completed_tasks: [
         {complexity: 'above_grade', story_points: 8},
         {complexity: 'routine', story_points: 3}
       ],
       help_events: [
         {type: 'mentoring', duration_hours: 4}
       ],
       roles: [
         {type: 'temporary_lead', duration_weeks: 4}
       ],
       months_in_company: 12
     };
     
     const mockCohort = [
       {axis_1_breadth: 5, axis_2_depth: 4, axis_3_peer_leadership: 3, axis_4_formal_leadership: 1},
       {axis_1_breadth: 7, axis_2_depth: 6, axis_3_peer_leadership: 5, axis_4_formal_leadership: 3}
     ];
     
     const result = internalAnalyzer.analyze(userProfile, mockCohort, mockAvatar);
     
     // Проверяем что все оси рассчитаны
     expect(result.user_axes).toEqual({
       axis_1_breadth: 2,    // 2 технологии
       axis_2_depth: 5,      // 1 из 2 задач сложная
       axis_3_peer_leadership: 3, // 1 менторинг
       axis_4_formal_leadership: 1 // 1 временная роль
     });
     
     // Проверяем что рекомендации учитывают все оси
     expect(result.recommendations.priority_axis).toBe('axis_1_breadth'); // Самая отстающая
     expect(result.recommendations.overall_verdict).toBe('developing_well');
   });
   ```

3. **External Growth Algorithm Unit Testing - Динамический эталон**:
   ```typescript
   // ✅ Тестируем рыночное позиционирование
   test('builds dynamic benchmark correctly', () => {
     const marketCohort = [
       {salary_current: 80000, role_level: 'middle', skills_count: 8},
       {salary_current: 120000, role_level: 'senior', skills_count: 12},
       {salary_current: 100000, role_level: 'middle', skills_count: 10},
       {salary_current: 150000, role_level: 'senior', skills_count: 15}
     ];
     
     const result = externalAnalyzer.buildDynamicBenchmark(marketCohort);
     
     expect(result.salary_range).toEqual({min: 80000, max: 150000, median: 110000});
     expect(result.role_distribution).toEqual({middle: 0.5, senior: 0.5});
     expect(result.skill_coverage).toEqual({median: 11, range: [8, 15]});
   });
   
   test('calculates market position correctly', () => {
     const userProfile = {
       salary_current: 95000,
       role_level: 'middle',
       skills_count: 9
     };
     
     const marketBenchmark = {
       salary_range: {min: 80000, max: 150000, median: 110000},
       role_distribution: {middle: 0.5, senior: 0.5},
       skill_coverage: {median: 11, range: [8, 15]}
     };
     
     const result = externalAnalyzer.calculateMarketPosition(userProfile, marketBenchmark);
     
     expect(result.salary_percentile).toBe(0.3); // 95k между 80k и 110k
     expect(result.skill_market_fit).toBe(0.82); // 9 из 11 медианных навыков
     expect(result.verdict).toBe('below_market_median');
   });
   ```

4. **Avatar-driven Navigation Testing - Динамические "призраки"**:
   ```typescript
   // ✅ Тестируем построение временных меток аватаров
   test('builds avatar ghost for live tracking data', () => {
     const avatar = {
       id: 'user_12345',
       source_type: 'live_tracking',
       timeline_data: [
         {month: 6, axis_1: 3, axis_2: 2, axis_3: 1, axis_4: 0},
         {month: 12, axis_1: 5, axis_2: 4, axis_3: 2, axis_4: 0},
         {month: 18, axis_1: 6, axis_2: 6, axis_3: 4, axis_4: 1}
       ]
     };
     
     const userMonth = 15; // Пользователь на 15 месяце
     const ghost = ghostBuilder.buildAvatarGhost(avatar, userMonth);
     
     // Проверяем интерполяцию между 12 и 18 месяцами
     expect(ghost.axis_1).toBeCloseTo(5.5, 1); // (5 + 6) / 2
     expect(ghost.axis_2).toBeCloseTo(5.0, 1); // (4 + 6) / 2
     expect(ghost.source_confidence).toBe('high'); // Live данные
   });
   
   test('builds avatar ghost for memory data', () => {
     const avatar = {
       id: 'user_67890',
       source_type: 'memory',
       final_axes: {axis_1: 7, axis_2: 8, axis_3: 6, axis_4: 2},
       total_duration_months: 24
     };
     
     const userMonth = 12; // Пользователь на 12 месяце
     const ghost = ghostBuilder.buildAvatarGhost(avatar, userMonth);
     
     // Проверяем приблизительную оценку (50% от финального)
     expect(ghost.axis_1).toBeCloseTo(3.5, 1); // 7 * 0.5
     expect(ghost.axis_2).toBeCloseTo(4.0, 1); // 8 * 0.5
     expect(ghost.source_confidence).toBe('medium'); // Memory данные
   });
   
   test('builds cohort ghost as average', () => {
     const cohort = [
       {axis_1: 5, axis_2: 4, axis_3: 3, axis_4: 1},
       {axis_1: 7, axis_2: 6, axis_3: 5, axis_4: 2},
       {axis_1: 6, axis_2: 5, axis_3: 4, axis_4: 1}
     ];
     
     const userMonth = 12;
     const ghost = ghostBuilder.buildCohortGhost(cohort, userMonth);
     
     // Проверяем усреднение
     expect(ghost.axis_1).toBeCloseTo(6.0, 1); // (5+7+6)/3
     expect(ghost.axis_2).toBeCloseTo(5.0, 1); // (4+6+5)/3
     expect(ghost.source_confidence).toBe('low'); // Усредненные данные
   });
   ```

5. **Avatar Change Algorithm Testing**:
   ```typescript
   // ✅ Тестируем логику смены аватаров
   test('suggests avatar change after persistent deviation', () => {
     const user = {
       current_axes: {axis_1: 3, axis_2: 2, axis_3: 1, axis_4: 0},
       months_of_deviation: 4, // 4 месяца отклонения
       growth_history: [
         {month: 1, axes: [1, 1, 0, 0]},
         {month: 2, axes: [1, 1, 0, 0]}, // Стагнация
         {month: 3, axes: [2, 1, 0, 0]},
         {month: 4, axes: [2, 1, 0, 0]}  // Снова стагнация
       ]
     };
     
     const avatar = {
       expected_axes: {axis_1: 6, axis_2: 5, axis_3: 3, axis_4: 1}
     };
     
     const result = avatarAnalyzer.analyzeAvatarFit(user, avatar);
     expect(result.action).toBe('suggest_avatar_change');
     expect(result.reason).toBe('persistent_deviation_after_seasonal_buffer');
   });
   
   test('waits during seasonal buffer period', () => {
     const user = {
       current_axes: {axis_1: 3, axis_2: 2, axis_3: 1, axis_4: 0},
       months_of_deviation: 2, // Только 2 месяца отклонения
       growth_history: [
         {month: 1, axes: [2, 2, 1, 0]},
         {month: 2, axes: [2, 2, 1, 0]} // Q4 медленнее
       ]
     };
     
     const avatar = {
       expected_axes: {axis_1: 6, axis_2: 5, axis_3: 3, axis_4: 1}
     };
     
     const result = avatarAnalyzer.analyzeAvatarFit(user, avatar);
     expect(result.action).toBe('wait_and_monitor');
     expect(result.reason).toBe('possible_seasonal_variance_or_temporary_slowdown');
   });
   
   test('finds new avatar based on user preference', () => {
     const user = {
       growth_velocity: 0.8, // Медленный рост
       current_month: 12,
       goals: 'more_ambitious'
     };
     
     const availableAvatars = [
       {id: 'avatar_1', velocity: 0.6, remaining_path: 12}, // Менее амбициозный
       {id: 'avatar_2', velocity: 1.0, remaining_path: 18}, // Похожий темп
       {id: 'avatar_3', velocity: 1.3, remaining_path: 24}  // Более амбициозный
     ];
     
     const result = avatarFinder.findNewAvatar(user, 'more_ambitious');
     expect(result.id).toBe('avatar_3'); // Выбран более амбициозный
     expect(result.velocity).toBeCloseTo(1.04, 2); // 0.8 * 1.3
   });
   ```

4. **Dynamic Benchmark Building**:
   ```typescript
   // Эталон строится динамически из текущей когорты
   export class DynamicBenchmarkBuilder {
     buildFromCohort(cohortProfiles: any[]): CareerBenchmark {
       return {
         salary_brackets: this.calculateSalaryBrackets(cohortProfiles),
         progression_timelines: this.analyzeProgressionSpeeds(cohortProfiles), 
         skill_adoption_curves: this.mapSkillAdoption(cohortProfiles),
         percentiles: this.calculatePercentiles(cohortProfiles)
       };
     }
   }
   
   // Анализ относительно динамического эталона
   const benchmark = benchmarkBuilder.buildFromCohort(similarProfiles);
   const analysis = careerAnalyzer.analyzeAgainstBenchmark(userProfile, benchmark);
   ```

### **Phase 1C: Dual Analysis Integration Testing**
**ЦЕЛЬ**: Объединить LightRAG поиск + Internal/External анализаторы

1. **Full Dual Pipeline Testing**:
   ```typescript
   test('complete dual analysis pipeline', async () => {
     const testUser = {
       id: 'user_test_001',
       skills: ['React', 'Node.js'],
       company_type: 'startup',
       team_size: 8,
       role_level: 'middle',
       experience_years: 3,
       location: 'Moscow'
     };
     
     // 1. LightRAG находит когорты для обоих типов анализа
     const internalCohort = await lightrag.findSimilar(testUser, {
       analysis_type: 'internal_growth',
       filters: ['company_type', 'team_size', 'role_level', 'tech_stack']
     });
     
     const externalCohort = await lightrag.findSimilar(testUser, {
       analysis_type: 'external_growth', 
       filters: ['role_level', 'tech_stack', 'experience_years', 'location']
     });
     
     // 2. Internal Growth анализ (4-осевая модель)
     const internalAnalysis = await internalGrowthAnalyzer.analyze(testUser, internalCohort, selectedAvatar);
     
     // 3. External Growth анализ (динамический эталон)
     const externalAnalysis = await externalGrowthAnalyzer.analyze(testUser, externalCohort);
     
     // 4. Проверяем результаты обоих анализов
     expect(internalAnalysis.user_axes).toBeDefined();
     expect(internalAnalysis.cohort_range).toBeDefined();
     expect(internalAnalysis.avatar_axes).toBeDefined();
     
     expect(externalAnalysis.salary_percentile).toBeDefined();
     expect(externalAnalysis.market_benchmark).toBeDefined();
     expect(externalAnalysis.skill_market_fit).toBeDefined();
     
     // 5. Проверяем что рекомендации учитывают оба анализа
     expect(internalAnalysis.recommendations.priority_axis).toBeDefined();
     expect(externalAnalysis.recommendations.market_position).toBeDefined();
   });
   ```

2. **Unified Analysis Testing - "Три лица"**:
   ```typescript
   test('unified analysis shows three reference points', async () => {
     const testUser = {
       id: 'user_test_001',
       current_axes: {axis_1: 4, axis_2: 5, axis_3: 3, axis_4: 1},
       salary_current: 95000,
       role_level: 'middle'
     };
     
     const internalCohort = [
       {axis_1: 3, axis_2: 4, axis_3: 2, axis_4: 0}, // Минимум когорты
       {axis_1: 7, axis_2: 8, axis_3: 6, axis_4: 3}  // Максимум когорты
     ];
     
     const externalCohort = [
       {salary_current: 80000, role_level: 'middle'},
       {salary_current: 120000, role_level: 'senior'}
     ];
     
     const avatar = {
       expected_axes: {axis_1: 6, axis_2: 7, axis_3: 5, axis_4: 2}
     };
     
     const unifiedAnalysis = await unifiedAnalyzer.analyze(testUser, internalCohort, externalCohort, avatar);
     
     // Проверяем "три лица" анализа
     expect(unifiedAnalysis.user_position).toBeDefined(); // Где ты сейчас
     expect(unifiedAnalysis.avatar_target).toBeDefined(); // Твой аватар
     expect(unifiedAnalysis.cohort_range).toBeDefined();  // Диапазон нормы
     
     // Проверяем что рекомендации учитывают все три ориентира
     expect(unifiedAnalysis.recommendations.internal_focus).toBeDefined();
     expect(unifiedAnalysis.recommendations.external_focus).toBeDefined();
     expect(unifiedAnalysis.recommendations.avatar_alignment).toBeDefined();
   });
   ```

2. **Source Attribution**:
   ```typescript
   // Отслеживаем откуда взялись данные для анализа с реальными ID
   expect(analysis.sources.attribution).toEqual({
     user_contribution: 0.2,
     cohort_memory_contribution: 0.5,
     cohort_live_contribution: 0.3
   });
   
   // Проверяем конкретные ID пользователей, которые повлияли на анализ
   expect(analysis.sources.profile_ids).toContain('user_12345');
   expect(analysis.sources.profile_ids).toContain('user_67890');
   expect(analysis.sources.profile_ids).not.toContain('user_99999'); // Нерелевантный профиль
   ```

### **Phase 1D: Dual Benchmark Evolution Testing**
**ЦЕЛЬ**: Тестировать эволюцию эталонов для Internal и External анализа

1. **Internal Growth Benchmark Evolution**:
   ```typescript
   test('internal growth benchmark evolution with new users', async () => {
     // Начальная когорта Internal Growth
     await loadInternalCohort([
       {id: 'user_001', axis_1: 4, axis_2: 5, axis_3: 3, axis_4: 1},
       {id: 'user_002', axis_1: 6, axis_2: 7, axis_3: 5, axis_4: 2},
       {id: 'user_003', axis_1: 5, axis_2: 6, axis_3: 4, axis_4: 1}
     ]);
     const initialInternalBenchmark = internalBenchmarkBuilder.buildFromCohort(loadedInternalCohort);
     
     // Добавляем нового пользователя с высокими показателями
     await addToInternalCohort([{id: 'user_004', axis_1: 8, axis_2: 9, axis_3: 7, axis_4: 3}]);
     const updatedInternalBenchmark = internalBenchmarkBuilder.buildFromCohort(loadedInternalCohort);
     
     // Анализируем изменение эталона по осям
     const axis1MedianChange = (updatedInternalBenchmark.axis_1_median - initialInternalBenchmark.axis_1_median) 
       / initialInternalBenchmark.axis_1_median;
     expect(axis1MedianChange).toBeCloseTo(0.2, 0.1); // ~20% увеличение медианы оси 1
     
     // Проверяем что новый пользователь включен в эталон
     expect(updatedInternalBenchmark.participant_ids).toContain('user_004');
   });
   ```

2. **External Growth Benchmark Evolution**:
   ```typescript
   test('external growth benchmark evolution with new users', async () => {
     // Начальная когорта External Growth
     await loadExternalCohort([
       {id: 'user_001', salary: 95000, role_level: 'middle'},
       {id: 'user_002', salary: 100000, role_level: 'middle'},
       {id: 'user_003', salary: 90000, role_level: 'middle'}
     ]);
     const initialExternalBenchmark = externalBenchmarkBuilder.buildFromCohort(loadedExternalCohort);
     
     // Добавляем Senior-разработчика
     await addToExternalCohort([{id: 'user_004', salary: 150000, role_level: 'senior'}]);
     const updatedExternalBenchmark = externalBenchmarkBuilder.buildFromCohort(loadedExternalCohort);
     
     // Анализируем изменение рыночного эталона
     const salaryMedianChange = (updatedExternalBenchmark.salary_median - initialExternalBenchmark.salary_median) 
       / initialExternalBenchmark.salary_median;
     expect(salaryMedianChange).toBeCloseTo(0.25, 0.1); // ~25% увеличение медианы зарплаты
     
     // Проверяем изменение распределения ролей
     expect(updatedExternalBenchmark.role_distribution.senior).toBeGreaterThan(0);
     expect(updatedExternalBenchmark.participant_ids).toContain('user_004');
   });
   ```

3. **Dual Context Manipulation Testing**:
   ```typescript
   test('same user, different internal contexts, different verdicts', async () => {
     const testUser = {
       id: 'user_test_001', 
       current_axes: {axis_1: 4, axis_2: 5, axis_3: 3, axis_4: 1},
       company_type: 'startup',
       team_size: 8
     };
     
     // Internal контекст 1: High-performers в стартапах
     await loadInternalCohort(['internal_unicorn_startup_developers']);
     const highPerfInternalAnalysis = await internalGrowthAnalyzer.analyze(testUser, loadedInternalCohort, mockAvatar);
     
     // Internal контекст 2: Strugglers в стартапах
     await loadInternalCohort(['internal_struggling_startup_developers']);
     const lowPerfInternalAnalysis = await internalGrowthAnalyzer.analyze(testUser, loadedInternalCohort, mockAvatar);
     
     // РАЗНЫЕ Internal рекомендации для одного пользователя!
     expect(highPerfInternalAnalysis.verdict).toBe('significantly_behind');
     expect(lowPerfInternalAnalysis.verdict).toBe('performing_well');
   });
   
   test('same user, different external contexts, different verdicts', async () => {
     const testUser = {
       id: 'user_test_001',
       salary: 95000,
       role_level: 'middle',
       skills: ['React', 'Node.js']
     };
     
     // External контекст 1: High-salary рынок
     await loadExternalCohort(['external_bigtech_react_developers']);
     const highSalaryExternalAnalysis = await externalGrowthAnalyzer.analyze(testUser, loadedExternalCohort);
     
     // External контекст 2: Average-salary рынок
     await loadExternalCohort(['external_average_react_developers']);
     const averageSalaryExternalAnalysis = await externalGrowthAnalyzer.analyze(testUser, loadedExternalCohort);
     
     // РАЗНЫЕ External рекомендации для одного пользователя!
     expect(highSalaryExternalAnalysis.verdict).toBe('below_market_median');
     expect(averageSalaryExternalAnalysis.verdict).toBe('at_market_median');
     
     // Проверяем что используются разные наборы ID для сравнения
     expect(highSalaryExternalAnalysis.benchmark_participants).not.toEqual(averageSalaryExternalAnalysis.benchmark_participants);
   });
   
   test('unified analysis shows context sensitivity', async () => {
     const testUser = {
       id: 'user_test_001',
       current_axes: {axis_1: 4, axis_2: 5, axis_3: 3, axis_4: 1},
       salary: 95000,
       role_level: 'middle'
     };
     
     // Контекст 1: High-performers (Internal + External)
     const highPerfUnifiedAnalysis = await unifiedAnalyzer.analyze(
       testUser, 
       highPerfInternalCohort, 
       highSalaryExternalCohort, 
       ambitiousAvatar
     );
     
     // Контекст 2: Average performers (Internal + External)
     const averagePerfUnifiedAnalysis = await unifiedAnalyzer.analyze(
       testUser, 
       averageInternalCohort, 
       averageSalaryExternalCohort, 
       moderateAvatar
     );
     
     // Проверяем что рекомендации кардинально разные
     expect(highPerfUnifiedAnalysis.overall_verdict).toBe('needs_acceleration');
     expect(averagePerfUnifiedAnalysis.overall_verdict).toBe('developing_well');
     
     // Проверяем что приоритеты фокуса разные
     expect(highPerfUnifiedAnalysis.priority_focus).toBe('internal_growth'); // Фокус на развитии
     expect(averagePerfUnifiedAnalysis.priority_focus).toBe('external_positioning'); // Фокус на рынке
   });
   ```

3. **Benchmark Evolution Tracking**:
   ```typescript
   // Отслеживаем дрифт эталона во времени
   const evolutionTracker = new BenchmarkEvolutionTracker();
   evolutionTracker.recordBenchmarkSnapshot(cohort, {phase: 'baseline'});
   
   // После изменений когорты
   const driftAnalysis = evolutionTracker.analyzeBenchmarkDrift();
   expect(driftAnalysis.recommendation_consistency.consistency_score).toBeGreaterThan(0.7);
   
   // Проверяем какие конкретные ID пользователей повлияли на дрифт
   expect(driftAnalysis.participant_changes.added_ids).toContain('user_004');
   expect(driftAnalysis.participant_changes.removed_ids).toEqual([]);
   ```

---

## 🚀 IMMEDIATE NEXT STEPS

### **Следующие 2-3 часа**:
1. ✅ Создать cohort data structure (cohorts.json + avatars.json)
2. ✅ Реализовать LightRAG поиск похожих профилей (БЕЗ аналитики)
3. ✅ Написать DynamicBenchmarkBuilder для создания эталона из когорты
4. ✅ Базовый CohortManager для loading/configuring тестовых данных

### **Следующие 1-2 дня**:
1. ✅ Skill Saturation Algorithm с unit тестами (наша математика)
2. ✅ Benchmark evolution testing (стабильность эталона)
3. ✅ Context manipulation tests (один пользователь, разные эталоны)
4. ✅ BenchmarkEvolutionTracker для отслеживания дрифта

### **Цель недели**:
**Получить controllable dual career intelligence system** с Internal Growth (4-осевая) и External Growth (динамический эталон):
```json
{
  "unified_analysis": {
    "internal_growth": {
      "user_axes": [4, 5, 3, 1], // [широта, глубина, неформальное лидерство, формальная ответственность]
      "cohort_range": {"min": [2,3,1,0], "max": [8,9,7,4]},
      "avatar_axes": [6, 7, 5, 2], // Ожидаемые значения аватара
      "verdict": "developing_well",
      "priority_axis": "axis_1_breadth"
    },
    "external_growth": {
      "salary_percentile": 0.25, // Относительно текущей когорты
      "role_progression": "below_benchmark", 
      "skill_market_fit": 0.82,
      "verdict": "below_market_median"
    },
    "unified_recommendations": {
      "primary_focus": "internal_growth", // Фокус на развитии внутри компании
      "secondary_focus": "external_positioning", // Вторичный фокус на рынке
      "avatar_alignment": "on_track" // Соответствие аватару
    }
  },
  "benchmark_context": {
    "internal_cohort": {
      "composition": ["internal_startup_developers"],
      "axis_stats": {"axis_1_median": 6, "axis_2_median": 7, "axis_3_median": 5, "axis_4_median": 2},
      "sample_size": 15
    },
    "external_cohort": {
      "composition": ["external_react_middle"],
      "market_stats": {"salary_median": 110000, "progression_median": 18},
      "sample_size": 50
    }
  },
  "benchmark_sensitivity": {
    "context_change_impact": "high", // При смене когорты меняются рекомендации
    "internal_stability_score": 0.8, // Стабильность Internal эталона
    "external_stability_score": 0.7  // Стабильность External эталона
  }
}
```

**Ключевая особенность**: Можем **манипулировать контекстом** в тестах и видеть как меняются рекомендации для одного пользователя! Система показывает **"три лица"** анализа: пользователь, аватар, когорта. Все тесты работают с **реальными ID пользователей** из базы данных для корректной source attribution.

---

## 📝 TESTING WORKFLOW

```bash
# 1. Setup environment
cp .env.example .env  # Add API keys (OpenAI, LightRAG, BGE-m3)
npm install
npm run docker:up

# 2. Configure test cohorts for dual analysis
npm run test:cohort-config internal startup_developers bigtech_developers  # Load Internal cohorts
npm run test:cohort-config external react_middle python_senior            # Load External cohorts
npm run test:cohort-list                                                  # Show active cohorts
npm run test:cohort-stats                                                 # Data statistics

# 3. Run three-level testing for both analysis types
npm run test:internal-signal-pure startup_developers                      # Internal: Pure signal
npm run test:internal-signal-noise enterprise_developers                  # Internal: Pure noise
npm run test:internal-signal-mixed startup,enterprise                     # Internal: Signal + noise

npm run test:external-signal-pure react_middle                            # External: Pure signal
npm run test:external-signal-noise python_developers                      # External: Pure noise
npm run test:external-signal-mixed react_middle,python                    # External: Signal + noise

# 4. Test unified analysis scenarios
npm run test:scenario internal-growth "How to develop leadership skills?"
npm run test:scenario external-positioning "Should I change jobs for higher salary?"
npm run test:scenario unified-analysis "What's my overall career strategy?"

# 5. Direct LightRAG testing
curl POST http://localhost:8080/lightrag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "User: {\"skills\":[\"React\",\"JavaScript\"], \"situation\":\"stuck in mid-level\"} Question: How to grow?",
    "mode": "hybrid"
  }'

# 6. Verify results for dual analysis
# - Internal Growth Analysis:
#   * 4-axis calculation accuracy (breadth, depth, peer leadership, formal leadership)
#   * Avatar ghost interpolation (live vs memory data)
#   * Cohort range calculation (min/max/median per axis)
#   * Avatar change triggers (deviation detection, seasonal buffer)
# - External Growth Analysis:
#   * Dynamic benchmark building (salary range, role distribution, skill coverage)
#   * Market position calculation (percentiles, progression speed)
#   * Context sensitivity (different cohorts = different recommendations)
# - Unified Analysis:
#   * "Three faces" display (user, avatar, cohort)
#   * Primary/secondary focus determination
#   * Cross-analysis consistency
# - General Quality:
#   * Source attribution accuracy (user/cohort_memory/cohort_live breakdown)
#   * Profile ID traceability (which real user IDs influenced recommendation)
#   * Response stability (consistent results across runs)
#   * Signal filtering (irrelevant profiles ignored)
#   * Database ID consistency (all returned IDs exist in database)
```

---

**Status**: Ready to continue with Phase 1A - Dual Analysis Testing (Internal Growth + External Growth)  
**Last Updated**: 11.09.2025  
**Next Session**: Dual cohort data structure + InternalGrowthAnalyzer (4-осевая) + ExternalGrowthAnalyzer (динамический эталон) + Avatar-driven navigation tests
