# Промт для генерации тестовых контекстов (для AI как ChatGPT/Claude)

**Инструкция:** Сгенерируй 100 JSON-файлов в формате из schemas.md (прикрепи пример из data/contexts/test-context-1.json). Каждый JSON — история пользователя с 1-3 контекстами. Обеспечь разнообразие: роли (Junior/Middle/Senior Developer), домены (Frontend/Backend/Architecture), навыки (javascript/typescript/react/nodejs/aws и т.д.), exp (0-10+ лет), локации (de/berlin, us/new york и т.д.).

**Заготовки:**
- Базовый шаблон: из data/contexts/test-context-*.json (user_id, contexts с period/role/company/domains/tech/skills_hard).
- Схема: из schemas.md (строгая, required: user_id, contexts с context_id/role/role_started_at/domains_covered).

**Фокус:**
- 10 групп по 10 JSON (под 10 query-context, опиши их: базовый Senior Backend, Junior Frontend и т.д.).
- В каждой группе: 10 "идеальных" (высокий coverage>0.8, expDelta<1, общие домены/навыки с query) + шум (низкий match).
- Разнообразие: 30% малый exp, 40% средний, 30% большой; смесь доменов/локаций.
- Реализм: Варьируй tech/skills логично (Frontend — react/javascript).

**Проверка валидности:**
- После генерации каждого JSON проверь на AJV (симулируй: required поля, типы array/string). Если ошибка — доработай.
- Финал: 100 валидных JSON как массив объектов (я сохраню в файлы).

**Выход:** Массив из 100 объектов JSON. Опиши, как они покрывают кейсы.
