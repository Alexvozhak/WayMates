# Промпт для генерации тестовых данных с тропами

Дата: 2025-09-26

## Задача

Создать **РОВНО 50 JSON файлов** с карьерными историями программистов, включающих:
- **РОВНО 3 контекста** на каждого пользователя (карьерная прогрессия)
- **РОВНО 2 тропы** между контекстами (ctx1→ctx2, ctx2→ctx3)
- **Строгие временные рамки** и обязательный skill progression

## Структура данных

### StoryInput (основной объект):
```json
{
  "user_id": "string",
  "birth_year": number,
  "citizenships": ["string"],
  "contexts": [ContextInput...],
  "trails": [Trail...]
}
```

### ContextInput (карьерный этап):
```json
{
  "context_id": "string",
  "creation_reason": "skill_learning|role_change|goals_change|constraints_update|milestone_achieved|system_recommendation|other",
  "employment_period": {"start": "YYYY-MM", "end": "YYYY-MM|null"},
  "role_started_at": "YYYY-MM",
  "grade_awarded_at": "YYYY-MM", 
  "role": "string",
  "grade": "Junior|Middle|Senior|Lead",
  "company": {
    "size": "startup|medium|large",
    "industry": "fintech|e-commerce|healthcare|gaming|etc",
    "joined_at": "YYYY-MM"
  },
  "domains": ["Frontend", "Backend", "Mobile", "DevOps", "Data Science", "etc"],
  "skills": [
    {"name": "javascript", "category": "language"},
    {"name": "react", "category": "framework"},
    // categories: language|runtime|framework|library|database|cloud|devops|testing|competency|tool
  ],
  "work_conditions": {
    "work_type": "remote|hybrid|office",
    "schedule": "full-time|part-time",
    "team_size": number
  },
  "location": {
    "country": "us|de|fr|gb|ca|etc",
    "city": "string"
  }
}
```

### Trail (путь развития):
```json
{
  "trail_id": "string",
  "skill": "string", // навык который развивается
  "platform": "udemy|coursera|pluralsight|books|bootcamp|mentorship",
  "from_context_id": "string", // откуда идет переход
  "to_context_id": "string|null", // куда идет переход (null если ongoing)
  "total_duration_weeks": number, // udemy:4-8, coursera:6-12, pluralsight:3-6, mentorship:8-16, books:6-12, bootcamp:12-20
  "schedule": {
    "sessions_per_week": number, // udemy:3-5, coursera:3-5, pluralsight:4-6, mentorship:1-3, books:2-4, bootcamp:4-6
    "hours_per_session": number  // udemy:1-3, coursera:2-4, pluralsight:1-2, mentorship:1.5-3, books:0.5-2, bootcamp:6-10
  },
  "cost_usd": number, // udemy:50-300, coursera:100-400, pluralsight:150-250, mentorship:1500-3000, books:20-80, bootcamp:5000-12000
  "rating_course": number, // 3.5-5.0
  "rating_platform": number, // 4.0-4.8  
  "rating_schedule": number, // 3.0-5.0
  "course_name": "string",
  "course_link": "https://...", // реалистичный URL
  "user_feedback": "string" // опциональный отзыв ("Отличный курс, помог освоить React за месяц." | "Дорого, но ментор сэкономил время." | "Интенсивно, но результат стоил усилий.")
}
```

## Требования к контенту

### Карьерная логика:
1. **Временная последовательность** - contexts в хронологическом порядке
2. **Skill progression** - новые навыки появляются после изучения троп
3. **Realistic transitions** - Junior→Middle (18-30 месяцев), Middle→Senior (24-42 месяца)
4. **Role evolution** - Developer → Senior Developer → Tech Lead → etc
5. **Grade/Role синхронизация** - Senior grade только с Senior+ ролями
6. **Минимальный срок контекста** - 2+ месяца

### Принципы создания нового контекста:
- **Смена role/grade** - Junior → Middle → Senior
- **Смена компании** - даже та же роль, но новая среда/культура
- **Смена стека/домена** - Frontend → Backend, веб → мобильная
- **Значительный skill expansion** - добавилось 5+ новых технологий  
- **Career transition** - employment → freelance → employment
- **Career break с развитием** - unemployment но продолжает учиться

### Типовые 3-контекстные истории (вдохновляйся этими pattern'ами):

**1. Классический рост (user_001-015):**
- Ctx1: Student (university/bootcamp + pet проекты, БЕЗ employment_period)
- Ctx2: Junior Developer (первая работа, С employment_period)
- Ctx3: Middle Developer (рост через 2 года, +5 новых навыков)

**2. Смена направления (user_016-025):**
- Ctx1: Frontend Junior (React, основы веба)
- Ctx2: Fullstack Middle (добавил Node.js, databases через тропы)
- Ctx3: Backend Senior (фокус сместился, архитектура)

**3. Career transition (user_026-035):**
- Ctx1: Middle Developer (стабильная работа, established навыки)
- Ctx2: Freelancer/Career break (обучение новому стеку, БЕЗ employment_period)
- Ctx3: Senior в новой сфере (успешный переход, leadership)

**4. Corporate journey (user_036-045):**
- Ctx1: Junior в startup (быстрый рост, многозадачность)
- Ctx2: Middle в scale-up (специализация, процессы)
- Ctx3: Senior в enterprise (архитектура, team lead)

**5. Stack migration (user_046-050):**
- Ctx1: Java Developer Middle (backend, enterprise)
- Ctx2: Learning phase (Node.js, modern tools, БЕЗ employment_period)
- Ctx3: JavaScript Senior (новый стек, fullstack)

### Skill development patterns:
- **Base skills сохраняются** - JavaScript не исчезает при изучении TypeScript
- **Progressive complexity** - сначала React, потом Redux, потом архитектура
- **Domain expansion** - Frontend + постепенно Backend навыки
- **Tool evolution** - от простых к сложным (git → docker → kubernetes)

### Платформы обучения (СТРОГОЕ распределение):
- **udemy** - 20 троп 
- **coursera** - 10 троп
- **pluralsight** - 10 троп
- **mentorship** - 20 троп
- **books** - 20 троп
- **bootcamp** - 20 троп
**ИТОГО: 100 троп (50 пользователей × 2 тропы)**

### Реалистичные детали:

**ЛОГИЧНЫЕ ДИАПАЗОНЫ по типам платформ:**

| Platform | Duration (weeks) | Sessions/week | Hours/session | Cost (USD) | Course Rating | Platform Rating | Schedule Rating |
|----------|------------------|---------------|---------------|------------|---------------|-----------------|-----------------|
| udemy    | 4-8             | 3-5           | 1-3           | 50-300     | 4.0-4.5       | 4.2-4.6         | 3.5-4.5         |
| coursera | 6-12            | 3-5           | 2-4           | 100-400    | 4.2-4.7       | 4.4-4.8         | 4.0-4.5         |
| pluralsight | 3-6          | 4-6           | 1-2           | 150-250    | 3.8-4.3       | 4.0-4.5         | 3.0-4.0         |
| mentorship | 8-16          | 1-3           | 1.5-3         | 1500-3000  | 4.5-5.0       | 4.5-4.9         | 4.0-4.8         |
| books    | 6-12            | 2-4           | 0.5-2         | 20-80      | 3.5-4.5       | 4.0-4.5         | 3.0-4.0         |
| bootcamp | 12-20           | 4-6           | 6-10          | 5000-12000 | 4.0-4.8       | 4.2-4.7         | 3.5-4.5         |

**Варьировать в указанных диапазонах для реалистичности!**

## Популярные стеки для генерации

### Frontend пути:
- HTML/CSS → JavaScript → React → Redux/Context → Next.js
- HTML/CSS → JavaScript → Vue → Vuex → Nuxt.js  
- HTML/CSS → TypeScript → Angular → NgRx

### Backend пути:
- JavaScript → Node.js → Express → MongoDB → AWS
- Python → Django/Flask → PostgreSQL → Docker
- Java → Spring → MySQL → Microservices
- C# → .NET Core → SQL Server → Azure

### Fullstack progression:
- Frontend base → Backend навыки → DevOps basics → Architecture

### Data Science пути:
- Python → pandas/numpy → scikit-learn → TensorFlow/PyTorch
- R → statistics → machine learning → deep learning

## Примеры для reference

Используй как образцы качества (НЕ копируй, создавай новые):

**Senior Backend Developer пример:**
- Skills: typescript, nodejs, nestjs, postgresql, aws, docker, kubernetes
- Domain: Backend, Architecture  
- Company: large, fintech
- Grade: Senior

**Junior Frontend пример:**
- Skills: javascript, html, css, react, redux, jest
- Domain: Frontend
- Company: medium, e-commerce  
- Grade: Junior

## Алгоритм генерации (пошаговый)

### Шаг 1: Выбрать тип истории
- Определить номер пользователя (001-050)
- Выбрать соответствующий pattern из типовых историй
- Понять карьерную арку (Junior→Middle, Frontend→Backend и т.д.)

### Шаг 2: Создать временную линию
- Установить birth_year (1990-2000 для реалистичности в 2025)
- Определить даты для 3 контекстов (минимум 2 месяца каждый)
- Учесть realistic transitions (18-30 мес Junior→Middle, 24-42 мес Middle→Senior)

### Шаг 3: Создать Context 1 (стартовая точка)
- **Context 1:** определить role, grade, базовые skills (3-5), company
- employment_period: БЕЗ для Student/Learning, С для Employment
- Зафиксировать стартовое состояние карьеры

### Шаг 4: Создать Trail 1 (первый переход)
- **От:** Ctx1 **К:** Ctx2 
- **Trail.skill:** выбрать навык который нужен для следующего этапа карьеры
- **Platform:** согласно распределению (udemy=20, mentorship=20, etc.)
- Детали: duration, cost, ratings согласно таблице

### Шаг 5: Создать Context 2 (результат первой тропы)
- **Базовые skills:** сохранить из Ctx1
- **Новые skills:** добавить Trail1.skill + смежные навыки (2-4)
- **Role/Grade:** логичный переход от Ctx1
- **Company:** может измениться или остаться

### Шаг 6: Создать Trail 2 (второй переход) 
- **От:** Ctx2 **К:** Ctx3
- **Trail.skill:** навык для финального развития
- Следовать таблице диапазонов для платформы

### Шаг 7: Создать Context 3 (финальное состояние)
- **Базовые skills:** сохранить из Ctx1 + Ctx2  
- **Новые skills:** добавить Trail2.skill + advanced навыки
- **Role/Grade:** логичное завершение карьерной арки

### Шаг 8: Заполнить детали
- Названия курсов, feedback, realistic URLs для троп
- Company info, locations, work_conditions для контекстов
- birth_year, citizenships для пользователя
- Ratings согласно таблице диапазонов

### Шаг 9: Техническая валидация
- Проверить хронологию дат
- Убедиться что trail.skill появляется в следующем контексте
- Проверить уникальность всех ID
- Валидировать JSON синтаксис

### Шаг 10: Проверка реалистичности всей истории
**Общая логика карьеры:**
- [ ] Возраст соответствует опыту (не Senior в 22 года)
- [ ] Временные промежутки разумны (не 10 лет Junior)
- [ ] Salary/company progression логичен (startup → enterprise)
- [ ] Geographic перемещения объяснимы

**Skill evolution coherence:**
- [ ] Навыки развиваются логично (HTML → CSS → JS → React)
- [ ] Нет резких скачков без обучения (Junior → архитектор без троп)
- [ ] Base skills не пропадают (JavaScript не исчезает)
- [ ] Trail.skill действительно нужен для следующей роли

**Trail реалистичность:**
- [ ] Платформа подходит для skill (Kubernetes курс не на books)
- [ ] Cost/duration соответствует complexity навыка
- [ ] Timeline разумен (не изучать React за 1 неделю)
- [ ] Feedback соответствует experience level

**Career transition logic:**
- [ ] Смена компании обоснована (рост, новые возможности)
- [ ] Domain переходы логичны (Frontend → Fullstack → Backend)
- [ ] Grade advancement заслужен через skills/experience
- [ ] Employment gaps объяснены (learning, freelance)

## Файловая структура

**СТРОГИЙ формат файлов:** `trails_user_001.json` до `trails_user_050.json`

**СТРОГИЕ user_id:** "trails_user_001" до "trails_user_050"
**СТРОГИЕ context_id:** "ctx_001_1", "ctx_001_2", "ctx_001_3" (user_number_context_number) 
**СТРОГИЕ trail_id:** "trail_001_1", "trail_001_2" (user_number_trail_number)

## Технические требования

1. **Валидный JSON** - без синтаксических ошибок
2. **Уникальные ID** - context_id, trail_id, user_id должны быть уникальны глобально
3. **Правильные даты** - формат "YYYY-MM", логичная последовательность
4. **Непустые массивы** - contexts и skills не должны быть пустыми
5. **Корректные связи** - trail.from_context_id должен существовать в contexts
6. **Realistic URLs** - course_link должны выглядеть правдоподобно
7. **Employment_period правила** - НЕ указывать для Student/Learning контекстов, обязательно для Employment

## Дополнительные детали

### User feedback примеры:
- "Отличный курс по React, помог перейти в новую роль за 3 месяца"
- "Интенсивный bootcamp, но стоил потраченного времени и денег"  
- "Ментор помог не только с кодом, но и с карьерным планированием"
- "Документация была сложной, но pet проект все прояснил"

### Course names примеры:
- "Complete React Developer Course"
- "TypeScript Masterclass"  
- "AWS Solutions Architect"
- "Full Stack Web Development Bootcamp"
- "System Design Interview Prep"

### Разнообразие locations:
- США: new york, san francisco, austin, seattle
- Европа: london, berlin, amsterdam, paris, zurich  
- Другие: toronto, sydney, tokyo, singapore

## Контроль качества после генерации

### ОБЯЗАТЕЛЬНАЯ проверка каждого файла:

#### Автоматические проверки:
```bash
# 1. Валидация JSON синтаксиса
for file in trails_user_*.json; do 
  jq empty "$file" || echo "ОШИБКА JSON: $file"
done

# 2. Проверка количества файлов
ls trails_user_*.json | wc -l  # должно быть 50

# 3. Проверка структуры схемы (через TypeScript)
npx tsx validate_trails.ts trails_user_001.json
```

#### Ручные проверки (выборочно 5-10 файлов):

**✅ Временная логика:**
- [ ] Contexts в хронологическом порядке (start dates возрастают)
- [ ] employment_period.end = null только у последнего контекста
- [ ] role_started_at <= grade_awarded_at <= employment_period.start
- [ ] Реалистичные gaps между работами (0-3 месяца)

**✅ Skill progression:**
- [ ] Новые skills появляются после соответствующих троп
- [ ] Base skills сохраняются (JavaScript не исчезает)
- [ ] Progressive complexity (React → Redux → архитектура)
- [ ] Skill categories корректны (javascript=language, react=framework)

**✅ Career logic:**
- [ ] Grade progression логичен (Junior→Middle→Senior, НЕ Senior→Junior)
- [ ] Role соответствует grade (Senior grade = Senior+ роли)
- [ ] Domain expansion реалистичен (Frontend → Frontend+Backend)
- [ ] Company transitions объяснимы (startup→scale-up→enterprise)

**✅ Trail connections:**
- [ ] from_context_id существует в contexts массиве
- [ ] to_context_id существует или = null (для ongoing)
- [ ] Trail.skill появляется в следующем контексте
- [ ] Хронология: trail между ctx1 и ctx2 логично связан

**✅ Data consistency:**
- [ ] Уникальность всех ID (user_id, context_id, trail_id)
- [ ] Platform values из допустимого списка
- [ ] Ratings в правильных диапазонах (1-5)
- [ ] Cost/duration соответствует таблице значений

### Красные флаги (НЕМЕДЛЕННО исправить):
🚨 **Senior в 22 года** - нереалистично  
🚨 **JavaScript исчез после изучения Python** - skills не должны пропадать  
🚨 **Trail стоит $50000** - неправильная таблица значений  
🚨 **Employment gap 2 года** - нужно объяснение в creation_reason  
🚨 **Bootcamp за 2 недели** - нереалистичные timing  
🚨 **Grade downgrade** (Senior→Junior) без объяснения  

### Финальная валидация:

```bash
# Статистические проверки
echo "Распределение grades:" 
jq -r '.contexts[].grade' trails_user_*.json | sort | uniq -c

echo "Распределение платформ:"
jq -r '.trails[].platform' trails_user_*.json | sort | uniq -c

echo "Проверка уникальности ID:"
jq -r '.user_id' trails_user_*.json | sort | uniq -d  # должно быть пусто
```

**ЦЕЛЬ: Создать безупречную базу данных для тестирования алгоритмов поиска троп и аватаров.**
