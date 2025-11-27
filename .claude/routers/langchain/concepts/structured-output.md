# Structured Output - withStructuredOutput

**Назначение**: Получение Zod-валидированного structured output от LLM.

**Когда**: Extracting structured data, parsing user input, формат-валидация.

---

## Базовый пример

```typescript
import { z } from "zod";

const MovieSchema = z.object({
  title: z.string().describe("The title of the movie"),
  year: z.number().describe("Release year"),
  director: z.string().describe("Director name")
});

const structuredLlm = model.withStructuredOutput(MovieSchema);

const result = await structuredLlm.invoke("Tell me about Inception");
// result: { title: "Inception", year: 2010, director: "Christopher Nolan" }
```

**ВАЖНО**: Результат уже валидирован через Zod - не нужен safeParse.

---

## В tool для extraction

```typescript
import { tool } from "langchain";
import { Command } from "@langchain/langgraph";

const extractSingleContextTool = tool(
  async ({ text }) => {
    const llm = model.withStructuredOutput(userContextSchemaPartial);
    const result = await llm.invoke(`Extract career data: ${text}`);
    return result; // Уже валидированный partial context
  },
  {
    name: "extract_single_context",
    description: "Extract career context from text",
    schema: z.object({
      text: z.string().describe("Text to extract from")
    })
  }
);
```

**Production**: [shared-tools/index.ts:extractSingleContextTool](../../../../src/facade/langchain/shared-tools/index.ts)

---

## См. также

- [glossary.md#withstructuredoutput](../glossary.md#withstructuredoutput) - API reference
- [concepts/tools.md](#) - Использование в tools
