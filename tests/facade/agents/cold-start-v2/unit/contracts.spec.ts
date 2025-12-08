import { describe, expect, it } from "vitest";

import { AgentInvariantError } from "../../../../../src/facade/errors.js";
import {
  routeAfterContextDecision,
  routeAfterFinalDecision,
  routeAfterPlanCareer,
  routeAfterPlanDecision,
  routeAfterStoryDecision,
  routeAfterValidation,
} from "../../../../../src/facade/langGraph/cold-start-v2/decision-router.js";
import { responseBuilders } from "../../../../../src/facade/langGraph/cold-start-v2/response-builders.js";
import { decisionSchema, PHASE } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";
import { coldStartPhaseSchema, NODE } from "../../../../../src/facade/langGraph/cold-start-v2/types.js";

import type { ColdStartStateType, ParsedDecision } from "../../../../../src/facade/langGraph/cold-start-v2/state.js";
import type {
  ColdStartPhase,
  ContextAgenda,
  MissingField,
} from "../../../../../src/facade/langGraph/cold-start-v2/types.js";

function createMockState(overrides: Partial<ColdStartStateType> = {}): ColdStartStateType {
  return {
    messages: [],
    userId: "usr_test",
    phase: PHASE.story_gathering,
    userResponse: "",
    parsedDecision: null,
    queue: [],
    currentContextIndex: 0,
    collectedContexts: [],
    collectedTrails: [],
    pendingContext: null,
    pendingTrails: [],
    missingFields: [],
    clarificationRound: 0,
    currentEntityContext: undefined,
    ...overrides,
  };
}

function createDecision(intent: ParsedDecision["intent"]): ParsedDecision {
  return { intent, editTarget: "", editInstructions: "" };
}

describe("Cold-Start V2: Contract Tests (TC-C)", () => {
  /**
   * TC-C1: Graph topology verification
   *
   * Что тестируем:
   * Все conditional edges в графе соответствуют реальным target nodes.
   * Router функции возвращают только валидные node names.
   *
   * Given:
   * - Список всех target nodes из графа (NODE константа)
   * - Все router функции
   *
   * Then:
   * - Каждый router возвращает только node names из графа
   * - Нет "висячих" edges (orphan routes)
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-C1: Graph topology (edges === router targets)", () => {
    const validNodeNames = new Set(Object.values(NODE));

    it("routeAfterStoryDecision returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue"];

      for (const intent of intents) {
        const state = createMockState({ parsedDecision: createDecision(intent) });
        const target = routeAfterStoryDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });

    it("routeAfterPlanDecision returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue"];

      for (const intent of intents) {
        const state = createMockState({ parsedDecision: createDecision(intent) });
        const target = routeAfterPlanDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });

    it("routeAfterValidation returns valid node names", () => {
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
        const target = routeAfterValidation(state);
        expect(validNodeNames.has(target), `invalid target "${target}"`).toBe(true);
      }
    });

    it("routeAfterPlanCareer returns valid node names", () => {
      const scenarios: { phase: ColdStartPhase; queue: ContextAgenda[] }[] = [
        { phase: PHASE.failed, queue: [] },
        { phase: PHASE.story_gathering, queue: [] },
        {
          phase: PHASE.awaiting_plan_confirmation,
          queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
        },
      ];

      for (const scenario of scenarios) {
        const state = createMockState(scenario);
        const target = routeAfterPlanCareer(state);
        expect(validNodeNames.has(target), `invalid target "${target}"`).toBe(true);
      }
    });

    it("routeAfterContextDecision returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue"];

      for (const intent of intents) {
        const state = createMockState({
          parsedDecision: createDecision(intent),
          queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
          currentContextIndex: 0,
        });
        const target = routeAfterContextDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });

    it("routeAfterFinalDecision returns valid node names", () => {
      const intents: ParsedDecision["intent"][] = ["approve", "edit", "cancel", "continue"];

      for (const intent of intents) {
        const state = createMockState({ parsedDecision: createDecision(intent) });
        const target = routeAfterFinalDecision(state);
        expect(validNodeNames.has(target), `invalid target "${target}" for intent "${intent}"`).toBe(true);
      }
    });
  });

  /**
   * TC-C2: Router exhaustiveness
   *
   * Что тестируем:
   * Все значения intent из decisionSchema обрабатываются каждым router.
   * Нет unhandled intents которые приведут к undefined behavior.
   *
   * Given:
   * - Все возможные intent values из Zod schema
   * - Все router функции
   *
   * Then:
   * - Каждый router возвращает non-empty string для каждого intent
   * - Нет исключений при обработке любого intent
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-C2: Router exhaustiveness (all intents handled)", () => {
    const allIntents = decisionSchema.shape.intent.options;

    it("decisionSchema has expected intents", () => {
      expect(allIntents).toEqual(["approve", "edit", "cancel", "continue"]);
    });

    it("routeAfterStoryDecision handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({ parsedDecision: createDecision(intent) });
        const result = routeAfterStoryDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("routeAfterPlanDecision handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({ parsedDecision: createDecision(intent) });
        const result = routeAfterPlanDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("routeAfterContextDecision handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({
          parsedDecision: createDecision(intent),
          queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
        });
        const result = routeAfterContextDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("routeAfterFinalDecision handles all intents without throwing", () => {
      for (const intent of allIntents) {
        const state = createMockState({ parsedDecision: createDecision(intent) });
        const result = routeAfterFinalDecision(state);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  /**
   * TC-C3: Invariant guards verification
   *
   * Что тестируем:
   * getRequiredIntent() (внутри routers) бросает AgentInvariantError
   * если parsedDecision === null. Это защита от programming errors.
   *
   * Given:
   * - State с parsedDecision = null
   * - Router функции которые требуют parsedDecision
   *
   * Then:
   * - AgentInvariantError thrown с контекстом
   * - Ошибка содержит имя router и phase
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-C3: Invariant guards (parsedDecision NON-NULL after parse)", () => {
    it("routeAfterStoryDecision throws when parsedDecision is null", () => {
      const state = createMockState({ parsedDecision: null });

      expect(() => routeAfterStoryDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeAfterPlanDecision throws when parsedDecision is null", () => {
      const state = createMockState({ parsedDecision: null });

      expect(() => routeAfterPlanDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeAfterContextDecision throws when parsedDecision is null", () => {
      const state = createMockState({ parsedDecision: null });

      expect(() => routeAfterContextDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeAfterFinalDecision throws when parsedDecision is null", () => {
      const state = createMockState({ parsedDecision: null });

      expect(() => routeAfterFinalDecision(state)).toThrow(AgentInvariantError);
    });

    it("routeAfterValidation does NOT require parsedDecision (validation uses phase/missingFields)", () => {
      const state = createMockState({ parsedDecision: null, missingFields: [] });

      expect(() => routeAfterValidation(state)).not.toThrow();
    });

    it("routeAfterPlanCareer does NOT require parsedDecision (uses phase/queue)", () => {
      const state = createMockState({ parsedDecision: null, queue: [] });

      expect(() => routeAfterPlanCareer(state)).not.toThrow();
    });
  });

  /**
   * TC-C4: State completeness verification
   *
   * Что тестируем:
   * responseBuilders имеет handler для КАЖДОЙ фазы из coldStartPhaseSchema.
   * Нет missing handlers которые приведут к runtime errors.
   *
   * Given:
   * - Все фазы из coldStartPhaseSchema
   * - responseBuilders object
   *
   * Then:
   * - Каждая фаза имеет соответствующий builder
   * - Builder является функцией
   *
   * Тип теста: Unit (no LLM, no DB)
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
   * Все значения intent из decisionSchema покрыты роутерами.
   * Mapping intent → route существует для каждого intent в каждом роутере.
   *
   * Given:
   * - decisionSchema.shape.intent.options
   * - Все router функции
   *
   * Then:
   * - Каждый intent имеет deterministic route (не random)
   * - approve/edit/cancel/continue все обрабатываются
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-C5: Decision parsing (all Decision enum values covered)", () => {
    const intents = decisionSchema.shape.intent.options;

    it("approve intent routes to progression nodes", () => {
      const approveDecision = createDecision("approve");

      const storyState = createMockState({ parsedDecision: approveDecision });
      expect(routeAfterStoryDecision(storyState)).toBe("plan_career");

      const planState = createMockState({ parsedDecision: approveDecision });
      expect(routeAfterPlanDecision(planState)).toBe("extract_context");

      const contextState = createMockState({
        parsedDecision: approveDecision,
        queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
        currentContextIndex: 0,
      });
      expect(routeAfterContextDecision(contextState)).toBe("show_final");

      const finalState = createMockState({ parsedDecision: approveDecision });
      expect(routeAfterFinalDecision(finalState)).toBe("persist");
    });

    it("cancel intent routes to cancel node", () => {
      const cancelDecision = createDecision("cancel");

      const storyState = createMockState({ parsedDecision: cancelDecision });
      expect(routeAfterStoryDecision(storyState)).toBe("cancel");

      const planState = createMockState({ parsedDecision: cancelDecision });
      expect(routeAfterPlanDecision(planState)).toBe("cancel");

      const contextState = createMockState({
        parsedDecision: cancelDecision,
        queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
      });
      expect(routeAfterContextDecision(contextState)).toBe("cancel");

      const finalState = createMockState({ parsedDecision: cancelDecision });
      expect(routeAfterFinalDecision(finalState)).toBe("cancel");
    });

    it("edit intent routes appropriately per phase", () => {
      const editDecision = createDecision("edit");

      const planState = createMockState({ parsedDecision: editDecision });
      expect(routeAfterPlanDecision(planState)).toBe("gather_story");

      const contextState = createMockState({
        parsedDecision: editDecision,
        queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
      });
      expect(routeAfterContextDecision(contextState)).toBe("edit_context");

      const finalState = createMockState({ parsedDecision: editDecision });
      expect(routeAfterFinalDecision(finalState)).toBe("show_context");
    });

    it("continue intent routes to default (stay in current phase)", () => {
      const continueDecision = createDecision("continue");

      const storyState = createMockState({ parsedDecision: continueDecision });
      expect(routeAfterStoryDecision(storyState)).toBe("gather_story");

      const planState = createMockState({ parsedDecision: continueDecision });
      expect(routeAfterPlanDecision(planState)).toBe("show_plan");

      const contextState = createMockState({
        parsedDecision: continueDecision,
        queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
      });
      expect(routeAfterContextDecision(contextState)).toBe("show_context");

      const finalState = createMockState({ parsedDecision: continueDecision });
      expect(routeAfterFinalDecision(finalState)).toBe("show_final");
    });

    it("all intents from schema are tested", () => {
      const testedIntents = new Set(["approve", "edit", "cancel", "continue"]);
      expect(new Set(intents)).toEqual(testedIntents);
    });
  });

  /**
   * TC-P2 (unit): Empty plan → cancel routing
   *
   * Что тестируем:
   * routeAfterPlanCareer роутит в cancel когда queue пустой или phase failed.
   * Это unit-уровневая проверка routing logic.
   *
   * Given:
   * - State с phase: failed или queue: []
   *
   * Then:
   * - Router возвращает NODE.cancel
   *
   * Тип теста: Unit (no LLM, no DB)
   */
  describe("TC-P2 (unit): Empty plan → cancel routing", () => {
    it("routes to cancel when phase is failed", () => {
      const state = createMockState({ phase: PHASE.failed, queue: [] });
      expect(routeAfterPlanCareer(state)).toBe("cancel");
    });

    it("routes to cancel when queue is empty (regardless of phase)", () => {
      const state = createMockState({ phase: PHASE.story_gathering, queue: [] });
      expect(routeAfterPlanCareer(state)).toBe("cancel");
    });

    it("routes to show_plan when queue has contexts", () => {
      const state = createMockState({
        phase: PHASE.awaiting_plan_confirmation,
        queue: [{ contextId: "ctx_1", preview: "Test", incomingTrails: [] }],
      });
      expect(routeAfterPlanCareer(state)).toBe("show_plan");
    });
  });
});
