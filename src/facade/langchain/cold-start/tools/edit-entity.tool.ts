import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

import type { Trail, UserContext } from "../../../../shared/schemas.js";
import type { ColdStartState } from "../types.js";

const editEntityInputSchema = z.object({
  entityType: z.enum(["context", "trail"]).describe("Type of entity to edit"),
  entityId: z.string().describe("ID of entity (contextId or trailId)"),
  field: z.string().describe("Field name to update"),
  newValue: z.union([z.string(), z.number(), z.array(z.string())]).describe("New value for field"),
});

type EditEntityInput = z.infer<typeof editEntityInputSchema>;

function updateContext(
  contexts: UserContext[],
  entityId: string,
  field: string,
  newValue: unknown,
): UserContext[] {
  return contexts.map((ctx) => {
    if (ctx.contextId !== entityId) return ctx;
    return { ...ctx, [field]: newValue };
  });
}

function updateTrail(trails: Trail[], entityId: string, field: string, newValue: unknown): Trail[] {
  return trails.map((trail) => {
    if (trail.trailId !== entityId) return trail;
    return { ...trail, [field]: newValue };
  });
}

export const editEntityTool = tool(
  (
    { entityType, entityId, field, newValue }: EditEntityInput,
    toolConfig: { state: ColdStartState },
  ) => {
    const { collectedContexts = [], collectedTrails = [] } = toolConfig.state;
    console.log(`🔧 edit_entity: ${entityType}.${field} = ${String(newValue)}`);

    if (entityType === "context") {
      const updated = updateContext(collectedContexts, entityId, field, newValue);
      return new Command({
        update: { collectedContexts: updated },
      });
    }

    const updated = updateTrail(collectedTrails, entityId, field, newValue);
    return new Command({
      update: { collectedTrails: updated },
    });
  },
  {
    name: "edit_entity",
    description:
      "Apply minor corrections to entity without re-extraction. " +
      "Use for small fixes like typos or adding missed skills.",
    schema: editEntityInputSchema,
  },
);
