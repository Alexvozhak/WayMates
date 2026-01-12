import { userContextSchemaBase } from "@shared/schemas.js";

import type { Trail, UserContext } from "@shared/schemas.js";
import type { ZodTypeAny } from "zod";

export type FixtureData = {
  userId: string;
  currentContextId?: string;
  contexts: UserContext[];
  trails: Trail[];
};

const FIELD_DESCRIPTIONS = Object.entries(userContextSchemaBase.shape)
  .map(([k, v]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- accessing Zod internal _def
    const desc = (v as ZodTypeAny)._def.description as string | undefined;
    return desc ? `- ${k}: ${desc}` : null;
  })
  .filter(Boolean)
  .join("\n");

export function buildUnpackingPrompt(fixture: FixtureData): string {
  const fixtureJson = JSON.stringify(fixture, null, 2);

  return `Преобразуй JSON в рассказ от первого лица про карьерную историю.

Каждое непустое поле из JSON должно быть упомянуто в тексте.

## Описания полей

${FIELD_DESCRIPTIONS}

## Правила

- От первого лица
- Начни с представления: гражданство, образование, год рождения (если есть)
- Каждое непустое поле → упоминание в тексте (включая citizenships!)
- Не выдумывай данные которых нет в JSON
- Не упоминай технические ID
- Даты: "в 2022 году" вместо ISO формата

## trails (тропы обучения)

Вплети trails между соответствующими контекстами (fromContextId → toContextId).

## Формат

Только текст, без JSON, без markdown.

---

\`\`\`json
${fixtureJson}
\`\`\``;
}
