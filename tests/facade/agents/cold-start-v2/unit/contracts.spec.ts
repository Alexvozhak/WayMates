import { describe, expect, it } from "vitest";

import { AgentInvariantError } from "../../../../../src/facade/errors.js";
import {
  routeNextNodeAfterDecision,
  routeNextNodeAfterPlanCareer,
  routeNextNodeAfterValidation,
} from "../../../../../src/facade/langGraph/cold-start-v2/decision-router.js";
import { responseBuilders } from "../../../../../src/facade/langGraph/cold-start-v2/response-builders.js";
import { PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";
import { coldStartPhaseSchema, decisionSchema, NODE } from "../../../../../src/facade/langGraph/cold-start-v2/types.js";

import type { ColdStartStateType, ParsedDecision } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";
import type { ContextAgenda, MissingField } from "../../../../../src/shared/schemas.js";
import type { ColdStartPhase } from "../../../../../src/facade/langGraph/cold-start-v2/types.js";

function createMockState(overrides: Partial<ColdStartStateType> = {}): ColdStartStateType {
  return {
    messages: [],
    userId: "usr_test",
    locale: "en",
    phase: PHASE.story_gathering,
    userResponse: "",
    cvText: null,
    parsedDecision: null,
    queue: [],
    currentContextIndex: 0,
    collectedContexts: [],
    collectedTrails: [],
    pendingContext: null,
    pendingTrails: [],
    missingFields: [],
    optionalFields: [],
    clarificationRound: 0,
    currentEntityContext: undefined,
    normalizations: [],
    rolePositionSuggestions: [],
    ...overrides,
  };
}

function createDecision(intent: ParsedDecision["intent"]): ParsedDecision {
  return { reasoning: "test", intent, editTarget: "", editInstructions: "" };
}

function mockAgenda(id = "ctx_1"): ContextAgenda {
  return {
    contextId: id,
    startYear: 2020,
    endYear: null,
    title: "Test",
    preview: "2020-present: Test",
    incomingTrails: [],
  };
}

describe("Cold-Start V2: Contract Tests (TC-C)", () => {
  /**
   * TC-C1: Graph topology verification
   *
   * Что тестируем:
   * Все conditional edges в графе соответствуют реальным target nodes.
   * Router функции возвращают только валидные node names.
   */
  describe("TC-C1: Graph topology (edges === router targets)", () => {
    const validNodeNames = new Set(Object.values(NODE));

    it("routeNextNodeAfterDecision (story_gathering) returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue", "unknown"];

      for (const intent of intents) {
        const state = createMockState({
          phase: PHASE.story_gathering,
          parsedDecision: createDecision(intent),
        });
        const target = routeNextNodeAfterDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });

    it("routeNextNodeAfterDecision (awaiting_plan_confirmation) returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue", "unknown"];

      for (const intent of intents) {
        const state = createMockState({
          phase: PHASE.awaiting_plan_confirmation,
          parsedDecision: createDecision(intent),
        });
        const target = routeNextNodeAfterDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });

    it("routeNextNodeAfterValidation returns valid node names", () => {
      const missingField: MissingField = {
        field: "birthYear",
        entityLabel: "Test",
        entityType: "context",
        zodMessage: "Required",
      };

      const scenarios: { phase: ColdStartPhase; missingFields: MissingField[] }[] = [
        { phase: PHASE.failed, missingFields: [] },
        { phase: PHASE.story_gathering, missingFields: [missingField] },
        { phase: PHASE.story_gathering, missingFields: [] },
      ];

      for (const scenario of scenarios) {
        const state = createMockState(scenario);
        const target = routeNextNodeAfterValidation(state);
        expect(validNodeNames.has(target), `invalid target "${target}"`).toBe(true);
      }
    });

    it("routeNextNodeAfterPlanCareer returns valid node names", () => {
      const scenarios: { phase: ColdStartPhase; queue: ContextAgenda[] }[] = [
        { phase: PHASE.failed, queue: [] },
        { phase: PHASE.story_gathering, queue: [] },
        {
          phase: PHASE.awaiting_plan_confirmation,
          queue: [mockAgenda()],
        },
      ];

      for (const scenario of scenarios) {
        const state = createMockState(scenario);
        const target = routeNextNodeAfterPlanCareer(state);
        expect(validNodeNames.has(target), `invalid target "${target}"`).toBe(true);
      }
    });

    it("routeNextNodeAfterDecision (awaiting_context_confirmation) returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue", "unknown"];

      for (const intent of intents) {
        const state = createMockState({
          phase: PHASE.awaiting_context_confirmation,
          parsedDecision: createDecision(intent),
          queue: [mockAgenda()],
          currentContextIndex: 0,
        });
        const target = routeNextNodeAfterDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });

    it("routeNextNodeAfterDecision (awaiting_final_confirmation) returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue", "unknown"];

      for (const intent of intents) {
        const state = createMockState({
          phase: PHASE.awaiting_final_confirmation,
          parsedDecision: createDecision(intent),
        });
        const target = routeNextNodeAfterDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });
  });

  /**
   * TC-C2: Router exhaustiveness
   *
   * Что тестируем:
   * Все значения intent из decisionSchema обрабатываются routeNextNodeAfterDecision.
   */
  describe("TC-C2: Router exhaustiveness (all intents handled)", () => {
    const allIntents = decisionSchema.shape.intent.options;

    it("decisionSchema has expected intents", () => {
      expect(allIntents).toEqual(["approve", "edit", "cancel", "continue", "unknown"]);
    });

    it("routeNextNodeAfterDecision (story_gathering) handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({
          phase: PHASE.story_gathering,
          parsedDecision: createDecision(intent),
        });
        const result = routeNextNodeAfterDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("routeNextNodeAfterDecision (awaiting_plan_confirmation) handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({
          phase: PHASE.awaiting_plan_confirmation,
          parsedDecision: createDecision(intent),
        });
        const result = routeNextNodeAfterDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("routeNextNodeAfterDecision (awaiting_context_confirmation) handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({
          phase: PHASE.awaiting_context_confirmation,
          parsedDecision: createDecision(intent),
          queue: [mockAgenda()],
        });
        const result = routeNextNodeAfterDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("routeNextNodeAfterDecision (awaiting_final_confirmation) handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({
          phase: PHASE.awaiting_final_confirmation,
          parsedDecision: createDecision(intent),
        });
        const result = routeNextNodeAfterDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  /**
   * TC-C3: Invariant guards verification
   *
   * Что тестируем:
   * routeNextNodeAfterDecision бросает AgentInvariantError если parsedDecision === null.
   */
  describe("TC-C3: Invariant guards (parsedDecision NON-NULL after parse)", () => {
    it("routeNextNodeAfterDecision throws when parsedDecision is null (story_gathering)", () => {
      const state = createMockState({ phase: PHASE.story_gathering, parsedDecision: null });
      expect(() => routeNextNodeAfterDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeNextNodeAfterDecision throws when parsedDecision is null (awaiting_plan_confirmation)", () => {
      const state = createMockState({ phase: PHASE.awaiting_plan_confirmation, parsedDecision: null });
      expect(() => routeNextNodeAfterDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeNextNodeAfterDecision throws when parsedDecision is null (awaiting_context_confirmation)", () => {
      const state = createMockState({ phase: PHASE.awaiting_context_confirmation, parsedDecision: null });
      expect(() => routeNextNodeAfterDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeNextNodeAfterDecision throws when parsedDecision is null (awaiting_final_confirmation)", () => {
      const state = createMockState({ phase: PHASE.awaiting_final_confirmation, parsedDecision: null });
      expect(() => routeNextNodeAfterDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeNextNodeAfterValidation does NOT require parsedDecision (validation uses phase/missingFields)", () => {
      const state = createMockState({ parsedDecision: null, missingFields: [] });
      expect(() => routeNextNodeAfterValidation(state)).not.toThrow();
    });

    it("routeNextNodeAfterPlanCareer does NOT require parsedDecision (uses phase/queue)", () => {
      const state = createMockState({ parsedDecision: null, queue: [] });
      expect(() => routeNextNodeAfterPlanCareer(state)).not.toThrow();
    });
  });

  /**
   * TC-C4: State completeness verification
   *
   * Что тестируем:
   * responseBuilders имеет handler для КАЖДОЙ фазы из coldStartPhaseSchema.
   */
  describe("TC-C4: State completeness (response builders for all phases)", () => {
    const allPhases = coldStartPhaseSchema.options;

    it("coldStartPhaseSchema has expected phases", () => {
      expect(allPhases).toEqual([
        "story_gathering",
        "awaiting_plan_confirmation",
        "awaiting_clarification",
        "awaiting_context_confirmation",
        "awaiting_final_confirmation",
        "saved",
        "already_saved",
        "failed",
      ]);
    });

    it("responseBuilders has handler for every phase", () => {
      for (const phase of allPhases) {
        const builder = responseBuilders[phase];
        expect(builder, `missing builder for phase "${phase}"`).toBeDefined();
        expect(typeof builder, `builder for "${phase}" is not a function`).toBe("function");
      }
    });

    it("responseBuilders keys match coldStartPhaseSchema exactly", () => {
      const builderKeys = Object.keys(responseBuilders).toSorted();
      const schemaPhases = [...allPhases].toSorted();

      expect(builderKeys).toEqual(schemaPhases);
    });
  });

  /**
   * TC-C5: Decision parsing coverage
   *
   * Что тестируем:
   * Все значения intent из decisionSchema покрыты routeNextNodeAfterDecision.
   */
  describe("TC-C5: Decision parsing (all Decision enum values covered)", () => {
    const intents = decisionSchema.shape.intent.options;

    it("approve intent routes to progression nodes", () => {
      const approveDecision = createDecision("approve");

      const storyState = createMockState({ phase: PHASE.story_gathering, parsedDecision: approveDecision });
      expect(routeNextNodeAfterDecision(storyState)).toBe("plan_career");

      const planState = createMockState({ phase: PHASE.awaiting_plan_confirmation, parsedDecision: approveDecision });
      expect(routeNextNodeAfterDecision(planState)).toBe("extract_context");

      const contextState = createMockState({
        phase: PHASE.awaiting_context_confirmation,
        parsedDecision: approveDecision,
        queue: [mockAgenda()],
        currentContextIndex: 0,
      });
      expect(routeNextNodeAfterDecision(contextState)).toBe("show_final");

      const finalState = createMockState({ phase: PHASE.awaiting_final_confirmation, parsedDecision: approveDecision });
      expect(routeNextNodeAfterDecision(finalState)).toBe("persist");
    });

    it("cancel intent routes to cancel node", () => {
      const cancelDecision = createDecision("cancel");

      const storyState = createMockState({ phase: PHASE.story_gathering, parsedDecision: cancelDecision });
      expect(routeNextNodeAfterDecision(storyState)).toBe("cancel");

      const planState = createMockState({ phase: PHASE.awaiting_plan_confirmation, parsedDecision: cancelDecision });
      expect(routeNextNodeAfterDecision(planState)).toBe("cancel");

      const contextState = createMockState({
        phase: PHASE.awaiting_context_confirmation,
        parsedDecision: cancelDecision,
        queue: [mockAgenda()],
      });
      expect(routeNextNodeAfterDecision(contextState)).toBe("cancel");

      const finalState = createMockState({ phase: PHASE.awaiting_final_confirmation, parsedDecision: cancelDecision });
      expect(routeNextNodeAfterDecision(finalState)).toBe("cancel");
    });

    it("edit intent routes appropriately per phase", () => {
      const editDecision = createDecision("edit");

      const planState = createMockState({ phase: PHASE.awaiting_plan_confirmation, parsedDecision: editDecision });
      expect(routeNextNodeAfterDecision(planState)).toBe("gather_story");

      const contextState = createMockState({
        phase: PHASE.awaiting_context_confirmation,
        parsedDecision: editDecision,
        queue: [mockAgenda()],
      });
      expect(routeNextNodeAfterDecision(contextState)).toBe("edit_context");

      const finalState = createMockState({ phase: PHASE.awaiting_final_confirmation, parsedDecision: editDecision });
      expect(routeNextNodeAfterDecision(finalState)).toBe("show_context");
    });

    it("continue intent routes correctly per phase", () => {
      const continueDecision = createDecision("continue");

      // story_gathering: continue → gather_story (keep collecting)
      const storyState = createMockState({ phase: PHASE.story_gathering, parsedDecision: continueDecision });
      expect(routeNextNodeAfterDecision(storyState)).toBe("gather_story");

      // awaiting_plan_confirmation: continue → extract_context (proceed with plan)
      const planState = createMockState({ phase: PHASE.awaiting_plan_confirmation, parsedDecision: continueDecision });
      expect(routeNextNodeAfterDecision(planState)).toBe("extract_context");

      // awaiting_context_confirmation: no continue mapping → falls back to clarify_intent
      const contextState = createMockState({
        phase: PHASE.awaiting_context_confirmation,
        parsedDecision: continueDecision,
        queue: [mockAgenda()],
      });
      expect(routeNextNodeAfterDecision(contextState)).toBe("clarify_intent");

      // awaiting_final_confirmation: no continue mapping → falls back to clarify_intent
      const finalState = createMockState({
        phase: PHASE.awaiting_final_confirmation,
        parsedDecision: continueDecision,
      });
      expect(routeNextNodeAfterDecision(finalState)).toBe("clarify_intent");
    });

    it("all intents from schema are tested", () => {
      const testedIntents = new Set(["approve", "edit", "cancel", "continue", "unknown"]);
      expect(new Set(intents)).toEqual(testedIntents);
    });
  });

  /**
   * TC-P2 (unit): Empty plan → cancel routing
   */
  describe("TC-P2 (unit): Empty plan → cancel routing", () => {
    it("routes to cancel when phase is failed", () => {
      const state = createMockState({ phase: PHASE.failed, queue: [] });
      expect(routeNextNodeAfterPlanCareer(state)).toBe("cancel");
    });

    it("routes to cancel when queue is empty (regardless of phase)", () => {
      const state = createMockState({ phase: PHASE.story_gathering, queue: [] });
      expect(routeNextNodeAfterPlanCareer(state)).toBe("cancel");
    });

    it("routes to show_plan when queue has contexts", () => {
      const state = createMockState({
        phase: PHASE.awaiting_plan_confirmation,
        queue: [mockAgenda()],
      });
      expect(routeNextNodeAfterPlanCareer(state)).toBe("show_plan");
    });
  });
});
