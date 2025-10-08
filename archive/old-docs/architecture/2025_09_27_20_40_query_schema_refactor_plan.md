# План рефакторинга QueryFileSchema

## Проблема
- `QueryFileSchema.query` смешивает пользовательские + системные параметры
- `target_goal` и `query` дублируются по смыслу (оба = "искомый контекст")
- Системные параметры (min_coverage, limit) не должен задавать пользователь

## Решение
Разделить на 3 компонента:
1. `target_goal` - куда хочет прийти (TargetGoalSchema + добавить role_experience)
2. Системные параметры → использовать существующую SearchParamsSchema
3. `current_context?` - опциональная ссылка на исходный контекст (user_id + context_id)

## Что будет сломано 💥

### 1. Данные (10 файлов)
- `data/contexts/generated/queries/q1-q10.json` - все используют поле `query` с системными параметрами

### 2. Код (3 файла)
- `processQuery()` - использует `buildMatchParams()` (УБИРАЕМ)
- `loadQueries()` - парсит query структуру  
- Валидация `QueryFileSchema` в 2х местах

### 3. Тесты (2 файла) 
- `validateQueryFile.test.ts` (11 тестов) - тестируют query поле
- `buildMatchParams.test.ts` (4 теста) - **УДАЛЯЕМ** вместе с функцией
- `search.test.ts` - integration тесты

## Объем: СРЕДНИЙ 
~60-80 строк изменений + обновление 10 JSON файлов + новая логика загрузки контекстов
(Меньше работы: убираем buildMatchParams() + его тесты)

## План действий

### Этап 1: Схемы
1. Добавить `role_experience?: number` в существующую `TargetGoalSchema`
2. Создать `ContextReferenceSchema = { user_id, context_id }`
3. Обновить `QueryFileSchema`: 
   - `target_goal: TargetGoalSchema` (расширенная)
   - `current_context?: ContextReferenceSchema`
4. Системные параметры → использовать SearchParamsSchema в коде
5. Убрать ненужные схемы: `QueryParamsSchema`, `ContextMatchParamsSchema`

### Этап 2: Данные  
4. Модифицировать существующие q1-q10.json (НЕ создавать новые):
   - `query` → `target_goal` (убрать системные параметры: min_coverage, limit, etc.)
   - Добавить `role_experience` в target_goal
   - Добавить `current_context` в часть файлов для тестирования сценария перехода

### Этап 3: Код
5. **УБРАТЬ** `buildMatchParams()` совсем - передавать параметры напрямую в функции поиска
6. Обновить `processQuery()`:
   - Системные параметры из SearchParamsSchema как constants
   - Валидация ссылок: если `current_context` не найден → throw Error  
   - Два сценария: с контекстом vs без контекста
7. Обновить `loadQueries()` - читать target_goal вместо query
8. Добавить функцию `loadContextFromReference(user_id, context_id)` с валидацией
9. Обновить функции поиска: принимать `target_goal + systemParams` напрямую
10. Убрать лишние типы: `QueryParams`, `ContextMatchParams` (BREAKING CHANGE)

### Этап 4: Тесты  
7. Переписать тесты под новую структуру (БЕЗ обратной совместимости):
   - `validateQueryFile.test.ts` - новый формат target_goal + current_context
   - **УДАЛИТЬ** `tests/unit/buildMatchParams.test.ts` - функция больше не существует
   - `search.test.ts` - новые сценарии поиска (с контекстом vs без контекста)
8. Добавить оптимизацию: предзагрузка контекстов в `beforeAll()` для сьютов
9. Запустить полный тестовый прогон

## Риски
- **BREAKING CHANGE**: все тесты сломаются, нет обратной совместимости
- Строгая валидация: если current_context не найден → ошибка (правильно для тестов)
- Нужно аккуратно мигрировать JSON данные и обновить все тесты

## Преимущества рефакторинга
- **Два сценария поиска**: холодный поиск vs поиск от текущего контекста
- **Чистое разделение**: пользовательские цели vs системные параметры
- **Переиспользование**: TargetGoalSchema + SearchParamsSchema (уже протестированы)
- **Гибкость**: можно тестировать переходы между конкретными контекстами из trails_user_*.json
- **Готовность к тропам**: архитектура поддерживает поиск путей развития

## Альтернатива
Отложить до завершения текущих задач - это не критично для функциональности.
