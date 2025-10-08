# Промт для генерации Gold Labels

Это самодостаточный промт для AI, чтобы сгенерировать gold labels (идеальные матчи) для запросов в проекте WayMates.

## Пошаговая инструкция для AI

1. **Понять задачу:**
   - Вы — эксперт по матчингу IT-профилей. Для каждого "query" (профиля пользователя с ролью, навыками, опытом и т.д.) выберите 10 "gold" (идеальных) матчей из списка 100 контекстов.
   - Критерии для идеального матча:
     - **Пересечение навыков >70%** (кол-во совпадающих навыков / общее кол-во навыков query).
     - **Разница в опыте ≤ exp_tolerance** (обычно ±1 год между role_experience query и реальным опытом контекста).
     - **Совпадение доменов** (хотя бы 1 домен должен совпадать, если require_domain = true).
     - **Бонус за локацию** (совпадение страны/города с desired_location).
     - **Минимальное покрытие навыков** ≥ min_coverage (обычно 0.6-0.8).
   - Justification для каждого gold ID: Короткое объяснение (1-2 предложения) на основе критериев.

2. **Входные данные (предоставьте в чате):**
/home/alex/projects/WayMates/data/contexts/generated/queries
   - **Queries**: JSON-массив запросов в новом формате:
     ```json
     [{"id": "q1_senior_backend", "query": {
       "role": "Senior Software Developer",
       "domains": ["Backend", "Architecture"],
       "skills": [{"name": "typescript", "category": "language"}, {"name": "nodejs", "category": "runtime"}],
       "role_experience": 1.0,
       "desired_location": {"country": "de", "city": "berlin"},
       "min_coverage": 0.6,
       "exp_tolerance": 1,
       "require_domain": true
     }}, ...]
     ```
   - **Contexts**: JSON-массив из 100 саммари контекстов:
     ```json
     [{"context_id": "ctx_q1_1_2", "summary": "Role: Senior Software Developer, domains: [Backend, Architecture], skills: [typescript, nodejs, aws, postgresql, kubernetes], role_started_at: 2024-09, location: de/berlin, company: fintech"}, ...]
     ```

3. **Что делать:**
   - Для каждого query проанализируйте 100 контекстов.
   - **Расчет опыта**: Используйте `role_started_at` контекста для вычисления фактического опыта (текущая дата - дата начала роли).
   - **Анализ навыков**: Сравните `skills.name` из query со skills контекста (игнорируйте категории для матчинга).
   - **Проверка доменов**: Убедитесь что минимум 1 домен из query присутствует в domains контекста.
   - **Покрытие навыков**: coverage = (совпавшие навыки / общее кол-во навыков query). Должно быть ≥ min_coverage.
   - **Толерантность опыта**: |фактический_опыт - role_experience| ≤ exp_tolerance.
   - Выберите 10 лучших gold ID, соответствующих критериям.
   - Укажите justification для каждого.
   - Выдайте как JSON: { "query_id": { "gold_ids": ["ctx_q1_1_2", ...], "justifications": ["Покрытие навыков 100% (5/5), опыт 1.0 лет (±0), домены Backend+Architecture, локация de/berlin", ...] } }

4. **Ожидаемый вывод:**
   - Валидный JSON-объект (без лишнего текста).
   - Пример: { "q1_senior_backend": { "gold_ids": ["ctx_q1_1_2", "ctx_q1_5_1"], "justifications": ["Полное совпадение навыков и роли", "Схожий стек и опыт"] }, "q2_junior_frontend": { ... } }
   - По 10 context_id на query, отсортированных по релевантности (лучшие первыми).

5. **Дополнительные замечания:**
   - **Структурированные навыки**: В новой версии навыки имеют categories (language, framework, database, cloud, devops, etc.), но для матчинга используйте только name.
   - **Новые поля контекстов**: creation_reason, employment_period, work_conditions, company - можете использовать для дополнительной оценки релевантности.
   - **Приоритизация**: Идеальный матч = точное совпадение роли + высокое покрытие навыков + подходящий опыт + совпадение доменов + бонус за локацию.

Теперь предоставьте входные данные, и сгенерируйте gold labels.
