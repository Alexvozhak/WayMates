# === Link ===
link-no-telegram-id = Could not get your Telegram ID
link-usage = Link LibreChat account

    Usage:
    /link <your_token>

    You can get the token in LibreChat via /token command
link-success = Accounts linked successfully! You can now use the bot.
link-already-exists = This Telegram account is already linked to another user

# === Token ===
token-unavailable = Token unavailable. Use /start to register.
token-display = Your LibreChat token:

    `{ $token }`

    Click on the token to copy.
    Use it in LibreChat: /link <token>

# === Errors ===
error-generic = An unexpected error occurred. Please try again later.

# MCP Error Codes (error-{code} format for bot.catch())
error-session_expired = Your session has expired. Please use /start to register again.
error-session_invalid = Invalid session. Please use /start to sign in.
error-unauthorized = Access denied. Please check your permissions.
error-invalid_token = Invalid token. Please use /start to register again.
error-normalization_failed = Failed to recognize the input. Please try rephrasing.
error-core_api_error = Server error while processing request. Please try again later.
error-validation_error = Invalid data. Please check your input.
error-internal_error = Internal server error. We're already working on a fix.
error-postgres_connection_failed = Database connection issues. Please try again later.
error-postgres_query_failed = Query execution error. Please try again later.
error-rate_limit = ⏱ Too many requests. Please wait a few seconds and try again.
