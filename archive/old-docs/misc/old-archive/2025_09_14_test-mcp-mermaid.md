# Тестирование MCP-Mermaid

## Валидная диаграмма
```mermaid
graph TD
    A[Начало] --> B{Условие?}
    B -->|Да| C[Действие 1]
    B -->|Нет| D[Действие 2]
    C --> E[Конец]
    D --> E
```

## Невалидная диаграмма (незакрытая скобка)
```mermaid
graph TD
    A[Начало] --> B{Условие?}
    B -->|Да| C[Действие 1
    B -->|Нет| D[Действие 2]
    C --> E[Конец]
    D --> E
```

## Сложная диаграмма из проекта
```mermaid
sequenceDiagram
    participant User
    participant Service
    participant Database
    
    User->>Service: Запрос
    Service->>Database: Получить данные
    Database-->>Service: Данные
    Service-->>User: Ответ
```

