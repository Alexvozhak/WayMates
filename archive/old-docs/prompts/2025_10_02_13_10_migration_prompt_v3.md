# Задача: Третья миграция схемы WayMates контекстов

## Цель
Добавить обязательное поле `creation_reason` во все существующие JSON контексты.

## Обязательное изменение:

### Добавление поля `creation_reason`:
```json
// БЫЛО (после предыдущих миграций):
{
  "user_id": "user_q1_1",
  "contexts": [
    {
      "context_id": "ctx_q1_1_2",
      "role": "Senior Software Developer",
      "domains": ["Backend", "Architecture"],
      "skills": [
        {"name": "typescript", "category": "language"}
      ],
      "work_conditions": {
        "work_type": "hybrid",
        "schedule": "full-time",
        "team_size": 12
      }
    }
  ]
}

// СТАЛО:
{
  "user_id": "user_q1_1",
  "contexts": [
    {
      "context_id": "ctx_q1_1_2",
      "creation_reason": "other",
      "role": "Senior Software Developer",
      "domains": ["Backend", "Architecture"],
      "skills": [
        {"name": "typescript", "category": "language"}
      ],
      "work_conditions": {
        "work_type": "hybrid",
        "schedule": "full-time",
        "team_size": 12
      }
    }
  ]
}
```

## Правила обработки:

1. **Добавить `creation_reason: "other"`** в каждый контекст сразу после `context_id`
2. **Все остальные поля оставить без изменений**
3. **Сохранить порядок полей**: `context_id`, затем `creation_reason`, затем остальные
4. **Сохранить форматирование JSON** (отступы, переносы строк)

## Возможные значения creation_reason:

- `"skill_learning"` - Изучение нового навыка
- `"role_change"` - Смена роли/позиции  
- `"goals_change"` - Изменение целей
- `"constraints_update"` - Обновление ограничений
- `"milestone_achieved"` - Достижение промежуточной цели
- `"system_recommendation"` - Системная рекомендация
- `"other"` - **Использовать для всех контекстов** (поскольку реальная причина неизвестна)

## Валидация после изменения:

Убедиться что каждый контекст содержит:
- `context_id` (строка)
- `creation_reason: "other"` (строка)
- `role` (строка)
- `domains` (массив строк, минимум 1 элемент)
- `skills` (массив объектов с полями name/category, минимум 1 элемент)
- `role_started_at` (строка формата YYYY-MM)

## Обработать все файлы в:
`/home/alex/projects/WayMates/data/contexts/generated/*.json` кроме папки `/queries/`

## Ожидаемый результат:
Все контексты будут содержать обязательное поле `creation_reason: "other"`.
