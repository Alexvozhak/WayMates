# === Welcome ===
welcome = Welcome to WayMates!

    I help find career paths based on similar professionals' experience.

    Available commands:
    /story — Start career history collection
    /by_target — Search by target position
    /by_current — Find similar to me
    /by_adhoc — Search by custom profile
    /help — Help

    Let's start with /story — tell me about your experience!

# === Navigation ===
action-required = Choose an action first:

    /story — Tell your career story
    /by_target — Search by target position
    /by_current — Find similar to me
    /by_adhoc — Compare with custom profile

story-required = Tell your career story first!

    Use /story to start.

# === Help ===
help = WayMates Commands

    Getting started:
    /start — Register
    /story — Tell your career story

    Career path search:
    /by_target <goal> — Find those who achieved the goal
    /by_current — Find similar to me*
    /by_adhoc <context> — Compare with profile

    Settings:
    /token — Show LibreChat token
    /link <token> — Link LibreChat
    /cancel — Cancel operation

    * requires completed /story

# === Story ===
story-prompt = Tell me about your career history:

    For example:
    Worked as a backend developer at Yandex from 2020 to 2023, wrote Python and Go.
    Then moved to a startup as Tech Lead...

    You can send text or voice message.

story-approved = { $message }

    Now you can:
    • /by_target — Search by target position
    • /by_current — Find similar to me
    • /by_adhoc — Search by custom profile
    • /story — Add more contexts

story-confirmed = Confirmed
story-edit-prompt = Enter changes to your career history:
story-cancelled = Story collection cancelled. Start over with /story

# === Buttons ===
button-approve = Approve
button-edit = Edit
button-cancel = Cancel

# === Callback Feedback ===
callback-processing = Processing...

# === Search Usage ===
target-usage = Search by target position

    Describe who you want to become:
    /by_target Senior ML Engineer in fintech
    /by_target Backend Python in Germany

    Text or voice message.

adhoc-usage = Search by custom profile

    Describe a profile to compare:
    /by_adhoc Backend Python 3 years at startup
    /by_adhoc Data Scientist ML at bank in Moscow

    Text or voice message.

current-usage = Search by your current profile

    Optionally specify filters:
    /by_current top 10
    /by_current exclude domains, limit 5
    /by_current last year only

    Or just /by_current for defaults.
    Text or voice message.

# === Status Messages ===
searching-target = Looking for those who achieved a similar goal...
searching-adhoc = Looking for similar career paths...
searching-current = Looking for similar career paths based on your profile...

# === Cancel ===
cancel-success = Operation cancelled. You can start over with /story
cancel-no-active = No active operations to cancel

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

# === Story & Goals ===
loading-story = ⏳ Loading your career story...
loading-goal = ⏳ Loading your goal...
goal-not-set = You haven't set a career goal yet. Use /goal set <goal description>
goal-usage = Describe your career goal:

    Example: /goal set Want to become Senior Backend in fintech
parsing-goal = ⏳ Analyzing your goal...
goal-set-success = ✅ Goal set! (ID: { $goalId })
goal-deleted = ✅ Goal deleted

# === Context & Trail Management ===
update-context-prompt = Describe changes to your current context:

    Example: Add React to skills
add-context-prompt = Describe a new career position:

    Example: Worked as Senior Backend at Google from 2020 to 2022 in SF, Python and Go
add-trail-prompt = Describe a learning trail:

    Example: Completed React course on Udemy over 8 weeks
delete-context-usage = Usage: /delete_context <contextId>
delete-trail-usage = Usage: /delete_trail <trailId>
context-deleted = ✅ Context deleted
trail-deleted = ✅ Trail deleted
context-not-found = ❌ Context not found. Check ID with /get_story
trail-not-found = ❌ Trail not found. Check ID with /get_story

# === LangGraph Workflows ===
langgraph-saved = ✅ Saved successfully!
langgraph-edit-prompt = Enter corrections
langgraph-cancelled = ❌ Operation cancelled

# === Feedback ===
feedback-prompt = Describe the issue or send feedback:
feedback-sent = ✅ Thank you for your feedback!
