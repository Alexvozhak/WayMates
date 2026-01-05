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

# === Document Upload ===
doc-pdf-only = Пока поддерживаются только PDF файлы. Отправьте резюме в формате PDF.
doc-processing = 📄 Обрабатываю резюме...
doc-cv-prefix = Вот моё резюме:
