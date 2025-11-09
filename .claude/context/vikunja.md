# Vikunja Response Format

## При создании задачи ВСЕГДА:

1. ✅ Возвращать прямую ссылку:
   ```
   http://localhost:3456/projects/{project_id}/tasks/{task_id}
   ```

2. ✅ Показывать ключевые атрибуты в компактном формате:
   ```
   ✅ Задача #1 создана: http://localhost:3456/projects/2/tasks/1

   **Fix TypeScript errors**
   - Приоритет: 5 (DO NOW) ⚡
   - Статус: todo
   - Проект: WayMates
   ```

## Приоритеты Vikunja (0-5):

| Значение | Название | Когда использовать |
|----------|----------|-------------------|
| 0 | Unset | Не указан |
| 1 | Low | Техдолг, рефакторинг |
| 2 | Medium | Улучшения |
| 3 | High | Баги |
| 4 | Urgent | Критичные баги |
| 5 | DO NOW | Блокеры, критические проблемы |

## URL Format

- **Проект**: `http://localhost:3456/projects/{project_id}`
- **Задача**: `http://localhost:3456/projects/{project_id}/tasks/{task_id}`
- **Главная**: `http://localhost:3456`

## MCP Tools Available

- `mcp__vikunja__vikunja_auth` - проверка подключения
- `mcp__vikunja__vikunja_tasks` - CRUD задач
- `mcp__vikunja__vikunja_projects` - управление проектами
- `mcp__vikunja__vikunja_labels` - метки
- `mcp__vikunja__vikunja_filters` - фильтры

## Типичные операции

### Создание задачи:
```typescript
mcp__vikunja__vikunja_tasks({
  subcommand: "create",
  projectId: 2,  // WayMates project
  title: "Task title",
  priority: 5,    // 0-5
  description: "Optional description"
})
```

### Список задач:
```typescript
mcp__vikunja__vikunja_tasks({
  subcommand: "list",
  projectId: 2,
  done: false  // только активные
})
```

### Обновление задачи:
```typescript
mcp__vikunja__vikunja_tasks({
  subcommand: "update",
  id: 1,
  done: true  // отметить как выполненную
})
```

## Конвенции

- **Всегда проверять проект ID** перед созданием задачи
- **Всегда возвращать прямую ссылку** после создания
- **Расшифровывать priority** (не просто "5", а "5 (DO NOW)")
- **Использовать эмодзи** для визуального акцента (⚡ для priority 5)
