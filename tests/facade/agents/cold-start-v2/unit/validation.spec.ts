import { describe, expect, it } from "vitest";

import {
  extractMissingFields,
  validateContextNode,
  validateAndCollectMissing,
} from "../../../../../src/facade/langGraph/cold-start-v2/nodes/validate-context.js";
import { PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";
import { userContextSchema, trailSchema } from "../../../../../src/shared/schemas.js";
import { UserStories } from "../../../../core/helpers/user-stories.js";
import {
  toExtractableContext,
  toExtractableTrail,
  createAgendaFromContext,
} from "../../cold-start/helpers/cold-start-helpers.js";

import type { ColdStartStateType } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";

const userStories = new UserStories();
const U1 = userStories.getStoryBy("U1");
const U10 = userStories.getStoryBy("U10");

function createMockState(overrides: Partial<ColdStartStateType> = {}): ColdStartStateType {
  const firstContext = U1.contexts[0]!;

  return {
    messages: [],
    userId: U1.userId,
    phase: PHASE.story_gathering,
    userResponse: "",
    cvText: null,
    parsedDecision: null,
    queue: [createAgendaFromContext(firstContext)],
    currentContextIndex: 0,
    collectedContexts: [],
    collectedTrails: [],
    pendingContext: toExtractableContext(firstContext),
    pendingTrails: [],
    missingFields: [],
    optionalFields: [],
    clarificationRound: 0,
    currentEntityContext: { contextIndex: 0, preview: firstContext.position },
    ...overrides,
  };
}

describe("Cold-Start V2: Validation (TC-V)", () => {
  /**
   * TC-V1: Valid context → awaiting_context_confirmation
   *
   * Что тестируем:
   * Когда все required поля заполнены корректно, validateContextNode
   * возвращает phase: awaiting_context_confirmation и сохраняет context.
   *
   * Given:
   * - pendingContext с валидными данными из U1 fixture
   * - pendingTrails пустой
   *
   * Then:
   * - phase === awaiting_context_confirmation
   * - collectedContexts содержит validated context
   * - missingFields === []
   * - clarificationRound === 0
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-V1: Valid context → awaiting_context_confirmation", () => {
    it("returns awaiting_context_confirmation for valid U1 context", () => {
      const state = createMockState();

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_context_confirmation);
      expect(result.missingFields).toEqual([]);
      expect(result.clarificationRound).toBe(0);
      expect(result.collectedContexts).toHaveLength(1);
    });

    it("validates U1 context against userContextSchema", () => {
      const firstContext = U1.contexts[0]!;

      const validation = userContextSchema.safeParse(firstContext);

      expect(validation.success).toBe(true);
    });

    it("validates U10 context with trails", () => {
      const firstContext = U10.contexts[0]!;
      const trails = U10.trails.filter((t) => t.toContextId === firstContext.contextId);

      const state = createMockState({
        userId: U10.userId,
        queue: [createAgendaFromContext(firstContext)],
        pendingContext: toExtractableContext(firstContext),
        pendingTrails: trails.map((trail) => toExtractableTrail(trail)),
      });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_context_confirmation);
      expect(result.collectedTrails!.length).toBe(trails.length);
    });

    it("clears pending state after successful validation", () => {
      const state = createMockState();

      const result = validateContextNode(state);

      expect(result.pendingContext).toBeNull();
      expect(result.pendingTrails).toEqual([]);
    });
  });

  /**
   * TC-V2: Missing required fields → awaiting_clarification
   *
   * Что тестируем:
   * Когда required поле отсутствует или null, validateContextNode
   * возвращает phase: awaiting_clarification с missingFields.
   *
   * Given:
   * - pendingContext с отсутствующим required полем (birthYear, position, skills)
   *
   * Then:
   * - phase === awaiting_clarification
   * - missingFields содержит информацию об ошибке
   * - clarificationRound инкрементирован
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-V2: Missing required fields → awaiting_clarification", () => {
    it("returns awaiting_clarification when role is empty", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.role = "";

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
      expect(result.missingFields!.length).toBeGreaterThan(0);
      expect(result.clarificationRound).toBe(1);
    });

    it("returns awaiting_clarification when position is empty", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.position = "";

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
    });

    it("returns awaiting_clarification when skills array is empty", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.skills = [];

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
    });

    it("returns awaiting_clarification when domains array is empty", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.domains = [];

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
    });

    it("returns awaiting_clarification when creationReason array is empty", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.creationReason = [];

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
    });

    it("increments clarificationRound on each validation failure", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.role = "";

      const state = createMockState({
        pendingContext: context,
        clarificationRound: 1,
      });

      const result = validateContextNode(state);

      expect(result.clarificationRound).toBe(2);
    });
  });

  /**
   * TC-V3: Invalid data types → awaiting_clarification
   *
   * Что тестируем:
   * Когда данные имеют неправильный формат (createdAt ISO 8601),
   * validateContextNode возвращает awaiting_clarification.
   *
   * Given:
   * - pendingContext с invalid createdAt format
   *
   * Then:
   * - phase === awaiting_clarification
   * - missingFields содержит информацию об ошибке формата
   *
   * Note: contextId в userContextSchemaBase — это просто z.string() без
   * валидации формата ctx_<UUID>. Формат проверяется на уровне agenda/queue.
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-V3: Invalid data types → awaiting_clarification", () => {
    it("returns awaiting_clarification when createdAt has invalid format", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.createdAt = "2024-01-15";

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
    });

    it("returns awaiting_clarification when birthYear is out of range", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.birthYear = 1800;

      const state = createMockState({ pendingContext: context });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
    });
  });

  /**
   * TC-E7: Max clarification attempts → failed
   *
   * Что тестируем:
   * После MAX_CLARIFICATION_ROUNDS (3) неудачных попыток,
   * validateContextNode возвращает phase: failed.
   *
   * Given:
   * - clarificationRound === 3 (MAX)
   * - pendingContext с ошибками валидации
   *
   * Then:
   * - phase === failed
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-E7: Max clarification attempts → failed", () => {
    it("returns failed when clarificationRound exceeds MAX_CLARIFICATION_ROUNDS (3)", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.role = "";

      const state = createMockState({
        pendingContext: context,
        clarificationRound: 3,
      });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.failed);
    });

    it("returns awaiting_clarification when clarificationRound is exactly 2", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.role = "";

      const state = createMockState({
        pendingContext: context,
        clarificationRound: 2,
      });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
      expect(result.clarificationRound).toBe(3);
    });

    it("fails immediately when clarificationRound is 3 and any validation fails", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.skills = [];

      const state = createMockState({
        pendingContext: context,
        clarificationRound: 3,
      });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.failed);
    });
  });

  /**
   * TC-V1.1: extractMissingFields helper
   *
   * Что тестируем:
   * Helper функция extractMissingFields корректно извлекает missing fields
   * из Zod validation errors.
   *
   * Given:
   * - Zod SafeParseResult с ошибками
   *
   * Then:
   * - MissingField[] с полем, label и zodMessage
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-V1.1: extractMissingFields helper", () => {
    it("returns empty array for successful validation", () => {
      const validation = userContextSchema.safeParse(U1.contexts[0]!);

      const missingFields = extractMissingFields(validation, "U1 Context", "context");

      expect(missingFields).toEqual([]);
    });

    it("extracts field name from validation error", () => {
      const invalidContext = { ...U1.contexts[0]!, role: "" };
      const validation = userContextSchema.safeParse(invalidContext);

      const missingFields = extractMissingFields(validation, "Backend Dev", "context");

      expect(missingFields.length).toBeGreaterThan(0);
      expect(missingFields[0]!.entityLabel).toBe("Backend Dev");
      expect(missingFields[0]!.entityType).toBe("context");
    });

    it("limits fields to MAX_QUESTIONS_PER_BATCH (default: 5)", () => {
      const invalidContext = {
        contextId: "invalid",
        previousContextId: "invalid",
        nextContextId: "invalid",
        createdAt: "invalid",
        creationReason: [],
        position: "",
        domains: [],
        skills: [],
        industry: "",
        companySize: "",
        countryCode: "",
        cityName: "",
        citizenships: [],
        birthYear: null,
        educationLevel: "INVALID",
      };
      const validation = userContextSchema.safeParse(invalidContext);

      const missingFields = extractMissingFields(validation, "Test", "context");

      expect(missingFields.length).toBeLessThanOrEqual(5);
    });
  });

  /**
   * TC-V1.2: validateAndCollectMissing helper
   *
   * Что тестируем:
   * Helper функция validateAndCollectMissing возвращает discriminated union
   * с success: true/false.
   *
   * Given:
   * - Valid/invalid context + trails from U1/U10
   *
   * Then:
   * - ValidationSuccess или ValidationFailure
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-V1.2: validateAndCollectMissing helper", () => {
    it("returns success: true for valid U1 context", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      const agenda = createAgendaFromContext(U1.contexts[0]!);

      const result = validateAndCollectMissing(context, [], agenda);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context).toBeDefined();
        expect(result.trails).toEqual([]);
      }
    });

    it("returns success: false for invalid context", () => {
      const context = toExtractableContext(U1.contexts[0]!);
      context.role = "";
      const agenda = createAgendaFromContext(U1.contexts[0]!);

      const result = validateAndCollectMissing(context, [], agenda);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.missing.length).toBeGreaterThan(0);
      }
    });

    it("validates both context and trails", () => {
      const context = toExtractableContext(U10.contexts[0]!);
      const agenda = createAgendaFromContext(U10.contexts[0]!);

      const invalidTrail = {
        ...toExtractableTrail(U10.trails[0]!),
        trailId: "invalid-trail-id",
      };

      const result = validateAndCollectMissing(context, [invalidTrail], agenda);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.missing.some((m) => m.entityType === "trail")).toBe(true);
      }
    });

    it("includes valid trails when context is valid", () => {
      const firstContext = U10.contexts[0]!;
      const context = toExtractableContext(firstContext);
      const agenda = createAgendaFromContext(firstContext);
      const trails = U10.trails
        .filter((t) => t.toContextId === firstContext.contextId)
        .map((trail) => toExtractableTrail(trail));

      const result = validateAndCollectMissing(context, trails, agenda);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.trails.length).toBe(trails.length);
      }
    });
  });

  /**
   * TC-V2.1: Trail validation errors
   *
   * Что тестируем:
   * Ошибки валидации trails также попадают в missingFields.
   *
   * Given:
   * - Valid context + invalid trail (missing trailId format)
   *
   * Then:
   * - awaiting_clarification
   * - missingFields содержит trail error
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-V2.1: Trail validation errors", () => {
    it("returns awaiting_clarification when trail has invalid trailId", () => {
      const firstContext = U10.contexts[0]!;

      const invalidTrail = {
        ...toExtractableTrail(U10.trails[0]!),
        trailId: "invalid-id",
      };

      const state = createMockState({
        userId: U10.userId,
        queue: [createAgendaFromContext(firstContext)],
        pendingContext: toExtractableContext(firstContext),
        pendingTrails: [invalidTrail],
      });

      const result = validateContextNode(state);

      expect(result.phase).toBe(PHASE.awaiting_clarification);
      expect(result.missingFields!.some((m) => m.entityType === "trail")).toBe(true);
    });

    it("validates U10 trail against trailSchema", () => {
      const firstTrail = U10.trails[0]!;

      const validation = trailSchema.safeParse(firstTrail);

      expect(validation.success).toBe(true);
    });
  });
});
