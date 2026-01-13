# LangGraph Prompts

| # | Правило | Пример |
|---|---------|--------|
| 1 | **Семантика, не примеры** | ❌ `"сеньор" → "senior"` ✅ `"find best semantic match"` |
| 2 | **Словари инжектировать** | `KNOWN_POSITIONS: ${dicts.positions.join(", ")}` |
| 3 | **Multilingual hint** | `"Response may be in any language"` |
| 4 | **unknown как fallback** | `.enum(["approve", "edit", "cancel", "unknown"])` |
| 5 | **Zod .describe() достаточно** | Не дублировать "Return structured JSON" |
