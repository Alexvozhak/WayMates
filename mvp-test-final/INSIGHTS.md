# Manual Testing Insights

> Инсайты из сессий ручного тестирования бота. Обновлять после каждой сессии.

---

## 2025-12-24: Первая сессия

### Найденные UX проблемы

1. **startAdhoc без контекста → cancel**
   - Пользователь: "Давай быстрый поиск"
   - Ожидание: бот спросит контекст
   - Реальность: пустой exploration → clarify → cancel
   - **Решение**: Добавлена нода `ask_adhoc_context` с interrupt

### Архитектурные инсайты

1. **Валидация adhocContext**
   - Минимум для поиска: position OR role OR countryCode OR domains(1+) OR skills(1+)
   - Если ничего — нужно спросить явно

2. **Routing после load_context**
   - Раньше: линейный edge → check_goal
   - Теперь: conditional edge → ask_adhoc_context ИЛИ check_goal

### Полезные команды

```bash
# Запуск бота с тестовой инфрой
npm run test:telegram:setup
npm run bot:test

# Логи фасада
docker logs waymates-facade-test -f

# Логи core
docker logs waymates-core-test -f

# Загрузка Kaggle данных
set -a && source .env.test && set +a && npx tsx scripts/import-kaggle.ts
```

---

## Шаблон для новых сессий

```markdown
## YYYY-MM-DD: Название сессии

### Найденные UX проблемы
1. ...

### Архитектурные инсайты
1. ...

### Изменённые файлы
- ...

### Открытые вопросы
- ...
```
