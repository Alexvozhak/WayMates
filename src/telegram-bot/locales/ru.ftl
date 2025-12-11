# === Welcome ===
welcome = Добро пожаловать в WayMates!

    Я помогу найти карьерные пути на основе опыта похожих специалистов.

    Доступные команды:
    /story — Начать сбор карьерной истории
    /by_target — Поиск по целевой позиции
    /by_current — Поиск похожих на меня
    /by_adhoc — Поиск по произвольному профилю
    /help — Справка

    Начнём с /story — расскажите о своём опыте!

# === Navigation ===
action-required = Сначала выберите действие:

    /story — Рассказать карьерную историю
    /by_target — Поиск по целевой позиции
    /by_current — Поиск по моему профилю
    /by_adhoc — Поиск по произвольному профилю

story-required = Сначала расскажите карьерную историю!

    Используйте /story для начала.

# === Help ===
help = Команды WayMates

    Начало работы:
    /start — Регистрация
    /story — Рассказать карьерную историю

    Поиск карьерных путей:
    /by_target <цель> — Найти достигших цели
    /by_current — Найти похожих на меня*
    /by_adhoc <контекст> — Сравнить с профилем

    Настройки:
    /token — Показать токен LibreChat
    /link <токен> — Привязать LibreChat
    /cancel — Отменить операцию

    * требует завершённый /story

# === Story ===
story-prompt = Расскажите о своей карьерной истории:

    Например:
    Работал backend разработчиком в Яндексе с 2020 по 2023, писал на Python и Go.
    Потом перешёл в стартап на позицию Tech Lead...

    Вы можете отправить текст или голосовое сообщение.

story-approved = { $message }

    Теперь вы можете:
    • /by_target — Поиск по целевой позиции
    • /by_current — Поиск похожих на меня
    • /by_adhoc — Поиск по произвольному профилю
    • /story — Добавить ещё контекстов

story-confirmed = Подтверждено
story-edit-prompt = Введите изменения к вашей карьерной истории:
story-cancelled = Сбор истории отменён. Начните заново с /story

# === Buttons ===
button-approve = Подтвердить
button-edit = Редактировать
button-cancel = Отмена

# === Callback Feedback ===
callback-processing = Обработка...

# === Search Usage ===
target-usage = Поиск по целевой позиции

    Опишите кем хотите стать:
    /by_target Senior ML Engineer в финтехе
    /by_target Backend Python в Германии

    Текстовое или голосовое сообщение.

adhoc-usage = Поиск по произвольному контексту

    Опишите профиль для сравнения:
    /by_adhoc Backend Python 3 года в стартапе
    /by_adhoc Data Scientist ML в банке Москва

    Текстовое или голосовое сообщение.

current-usage = Поиск по вашему текущему профилю

    Можно указать фильтры:
    /by_current топ 10
    /by_current исключить домены, лимит 5
    /by_current только за последний год

    Или просто /by_current для значений по умолчанию.
    Текстовое или голосовое сообщение.

# === Status Messages ===
searching-target = Ищу тех, кто уже достиг похожей цели...
searching-adhoc = Ищу похожие карьерные пути...
searching-current = Ищу похожие карьерные пути на основе вашего профиля...

# === Cancel ===
cancel-success = Операция отменена. Вы можете начать заново с /story
cancel-no-active = Нет активных операций для отмены

# === Link ===
link-no-telegram-id = Не удалось получить ваш Telegram ID
link-usage = Привязка LibreChat аккаунта

    Использование:
    /link <ваш_token>

    Токен можно получить в LibreChat через команду /token
link-success = Аккаунты успешно привязаны! Теперь вы можете использовать бота.
link-already-exists = Этот Telegram аккаунт уже привязан к другому пользователю

# === Token ===
token-unavailable = Токен недоступен. Используйте /start для регистрации.
token-display = Ваш токен для LibreChat:

    `{ $token }`

    Нажмите на токен чтобы скопировать.
    Используйте его в LibreChat: /link <token>

# === Errors ===
error-generic = Произошла непредвиденная ошибка. Попробуйте позже.

# MCP Error Codes (error-{code} format for bot.catch())
error-session_expired = Ваша сессия истекла. Используйте /start для повторной регистрации.
error-session_invalid = Недействительная сессия. Используйте /start для входа.
error-unauthorized = Доступ запрещен. Проверьте свои права доступа.
error-invalid_token = Недействительный токен. Используйте /start для повторной регистрации.
error-normalization_failed = Не удалось распознать введенные данные. Попробуйте переформулировать.
error-core_api_error = Ошибка сервера при обработке запроса. Попробуйте позже.
error-validation_error = Некорректные данные. Проверьте правильность ввода.
error-internal_error = Внутренняя ошибка сервера. Мы уже работаем над исправлением.
error-postgres_connection_failed = Проблемы с подключением к базе данных. Попробуйте позже.
error-postgres_query_failed = Ошибка при выполнении запроса. Попробуйте позже.
error-rate_limit = ⏱ Слишком много запросов. Подождите несколько секунд и попробуйте снова.

# === Story & Goals ===
loading-story = ⏳ Загружаю вашу карьерную историю...
loading-goal = ⏳ Загружаю вашу цель...
goal-not-set = У вас еще не установлена карьерная цель. Используйте /goal set <описание цели>
goal-usage = Опишите вашу карьерную цель:

    Пример: /goal set Хочу стать Senior Backend в финтехе
parsing-goal = ⏳ Анализирую вашу цель...
goal-set-success = ✅ Цель установлена! (ID: { $goalId })
goal-deleted = ✅ Цель удалена

# === Context & Trail Management ===
update-context-prompt = Опишите изменения в текущем контексте:

    Пример: Добавь React в навыки
add-context-prompt = Опишите новую карьерную позицию:

    Пример: Работал Senior Backend в Яндексе с 2020 по 2022 в Москве, Python и Go
add-trail-prompt = Опишите обучающий трейл:

    Пример: Прошел курс React на Udemy в течение 8 недель
delete-context-usage = Использование: /delete_context <contextId>
delete-trail-usage = Использование: /delete_trail <trailId>
context-deleted = ✅ Контекст удален
trail-deleted = ✅ Трейл удален
context-not-found = ❌ Контекст не найден. Проверьте ID через /get_story
trail-not-found = ❌ Трейл не найден. Проверьте ID через /get_story

# === LangGraph Workflows ===
langgraph-saved = ✅ Сохранено успешно!
langgraph-edit-prompt = Введите исправления
langgraph-cancelled = ❌ Операция отменена

# === Feedback ===
feedback-prompt = Опишите проблему или оставьте отзыв:
feedback-sent = ✅ Спасибо за обратную связь!
