/**
 * TrajectorySimilarityService Unit Tests
 *
 * Тестируем DTW (Dynamic Time Warping) алгоритмы для сравнения карьерных траекторий.
 * Фокус на edge cases и потенциальных багах, а не на coverage theater.
 *
 * Найденные проблемы в коде:
 * 1. Date.now() делает duration последнего контекста нестабильным
 * 2. creationReason case sensitive — "growth" ≠ "GROWTH"
 * 3. Пустой creationReason даёт max penalty (distance = 1)
 */

import { describe, it, expect, beforeAll } from "vitest";

import { TrajectorySimilarityService } from "../../../src/core/trajectory-similarity.service.js";
import { UserStories } from "../helpers/user-stories.js";

import type { UserContext } from "../../../src/shared/schemas.js";

// Доступ к private методам для unit testing
type PrivateMethods = {
  computeJaccardDistance: (setA: Set<string>, setB: Set<string>) => number;
  derivative: (series: number[]) => number[];
  calculateDurationMonths: (trajectory: UserContext[]) => number[];
  validatePathLength: (pathLength: number, userTrajectoryLength: number, candidateTrajectoryLength: number) => void;
  trajectoryDistance: (stepA: UserContext, stepB: UserContext, durationA: number, durationB: number) => number;
};

describe("TrajectorySimilarityService", () => {
  let service: TrajectorySimilarityService;
  let privateMethods: PrivateMethods;
  let userStories: UserStories;

  beforeAll(() => {
    // Сервис не требует DB для чистых математических функций
    // @ts-expect-error -- null DB для unit testing pure functions
    service = new TrajectorySimilarityService(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    privateMethods = service as any;
    userStories = new UserStories();
  });

  describe("TC-TS1: Date.now() зависимость в calculateDurationMonths", () => {
    /**
     * TC-TS1: Duration последнего контекста зависит от текущей даты
     *
     * Что тестируем:
     * Последний контекст использует Date.now() для расчёта duration.
     * Это делает результаты нестабильными во времени.
     *
     * Given:
     * - U10: 3 контекста (2022-01-01, 2023-01-01, 2025-01-01)
     *
     * Then:
     * - duration[0] = 12 месяцев (2022 → 2023)
     * - duration[1] = 24 месяца (2023 → 2025)
     * - duration[2] = X месяцев от 2025-01-01 до сейчас (нестабильно!)
     */
    it("TC-TS1: duration последнего контекста зависит от Date.now()", () => {
      const u10 = userStories.getStoryBy("U10");

      const durations = privateMethods.calculateDurationMonths(u10.contexts);

      // Первые два duration стабильны
      expect(durations[0]).toBe(12); // 2022-01-01 → 2023-01-01
      expect(durations[1]).toBe(24); // 2023-01-01 → 2025-01-01

      // Последний duration зависит от Date.now()
      // На декабрь 2025: ~11 месяцев
      // Тест ДОКУМЕНТИРУЕТ поведение, а не фиксирует точное значение
      expect(durations[2]).toBeGreaterThan(0);

      // Проверяем что duration растёт со временем (бизнес-правило)
      const now = new Date();
      const lastContextDate = new Date("2025-01-01T00:00:00Z");
      const expectedMonths = Math.round((now.getTime() - lastContextDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      expect(durations[2]).toBe(expectedMonths);
    });
  });

  describe("TC-TS2: Case sensitivity в Jaccard distance", () => {
    /**
     * TC-TS2: creationReason case sensitive — потенциальный баг
     *
     * Что тестируем:
     * Jaccard distance не нормализует case.
     * "growth" и "GROWTH" считаются разными значениями.
     *
     * Given:
     * - setA: ["growth"]
     * - setB: ["GROWTH"]
     *
     * Then:
     * - distance = 1.0 (no overlap) — ЭТО БАГ если данные не нормализованы
     */
    it("TC-TS2: разный case = разные значения (потенциальный баг)", () => {
      const setA = new Set(["growth"]);
      const setB = new Set(["GROWTH"]);

      const distance = privateMethods.computeJaccardDistance(setA, setB);

      // Документируем текущее поведение — это потенциальный баг!
      expect(distance).toBe(1); // No overlap из-за case difference
    });

    /**
     * TC-TS2b: Одинаковый case — работает корректно
     */
    it("TC-TS2b: одинаковый case = overlap найден", () => {
      const setA = new Set(["growth", "career_change"]);
      const setB = new Set(["growth", "promotion"]);

      const distance = privateMethods.computeJaccardDistance(setA, setB);

      // intersection = 1 (growth), union = 3
      // similarity = 1/3, distance = 2/3
      expect(distance).toBeCloseTo(2 / 3, 5);
    });
  });

  describe("TC-TS3: Пустой creationReason edge case", () => {
    /**
     * TC-TS3: Пустой creationReason даёт максимальный penalty
     *
     * Что тестируем:
     * Если у одного контекста creationReason = [], а у другого есть причины,
     * то Jaccard distance = 1.0 (максимальный penalty).
     *
     * Given:
     * - stepA: creationReason = []
     * - stepB: creationReason = ["growth"]
     *
     * Then:
     * - reasonsDiff = 1.0 (max penalty)
     * - Общий distance увеличивается на 0.25 (1/4 веса)
     */
    it("TC-TS3: пустой creationReason = max penalty", () => {
      const setA = new Set<string>(); // пустой
      const setB = new Set(["growth"]);

      const distance = privateMethods.computeJaccardDistance(setA, setB);

      // intersection = 0, union = 1
      // similarity = 0, distance = 1
      expect(distance).toBe(1);
    });

    /**
     * TC-TS3b: Оба пустых — distance = 0 (по convention)
     */
    it("TC-TS3b: оба пустых = distance 0", () => {
      const setA = new Set<string>();
      const setB = new Set<string>();

      const distance = privateMethods.computeJaccardDistance(setA, setB);

      // По convention: оба пустых = идентичны
      expect(distance).toBe(0);
    });
  });

  describe("TC-TS4: DTW с реальными fixtures U10/U11", () => {
    /**
     * TC-TS4: U10 vs U11 — похожие траектории (Backend Node.js vs Python)
     *
     * Что тестируем:
     * Два разработчика с похожими траекториями (Junior → Middle → Senior, Backend)
     * должны иметь высокий DTW score, несмотря на разные skills.
     *
     * Given:
     * - U10: Backend Node.js (3 контекста, 2022 → 2023 → 2025)
     * - U11: Backend Python (3 контекста, те же даты)
     *
     * Then:
     * - shapeSimilarity > 0.8 (похожие positions/domains)
     * - stabilityScore > 0.8 (одинаковая длина траектории)
     *
     * Бизнес-правило:
     * Skills (nodejs vs python) НЕ учитываются в DTW — это design decision.
     * Skills обрабатываются через penalties в SearchManager.
     */
    it("TC-TS4: похожие траектории → высокий DTW score", () => {
      const u10 = userStories.getStoryBy("U10");
      const u11 = userStories.getStoryBy("U11");

      const metrics = service.computeDTWMetrics(u10.contexts, u11.contexts);

      // Smoke test: похожие траектории → высокие scores
      // (точные значения зависят от fixture data, проверяем только "высокий")
      expect(metrics.shapeSimilarity).toBeGreaterThan(0.8);
      expect(metrics.stabilityScore).toBeGreaterThan(0.9);
    });

    /**
     * TC-TS4b: tempoSimilarity учитывает длительности контекстов
     *
     * U10 и U11 имеют идентичные даты (2022→2023→2025),
     * поэтому tempo должен быть максимальным (≈1.0).
     */
    it("TC-TS4b: идентичные даты → tempoSimilarity ≈ 1.0", () => {
      const u10 = userStories.getStoryBy("U10");
      const u11 = userStories.getStoryBy("U11");

      const metrics = service.computeDTWMetrics(u10.contexts, u11.contexts);

      // Даты идентичны → tempo близок к максимуму
      expect(metrics.tempoSimilarity).toBeGreaterThan(0.95);
    });
  });

  describe("TC-TS5: trajectoryDistance компоненты", () => {
    /**
     * TC-TS5: Position difference = 0.25 от общего distance
     *
     * Что тестируем:
     * Разный position добавляет ровно 0.25 к distance (1/4 веса).
     *
     * Given:
     * - stepA: position = "junior", всё остальное идентично
     * - stepB: position = "senior", всё остальное идентично
     *
     * Then:
     * - distance = 0.25 (только position отличается)
     */
    it("TC-TS5: разный position = +0.25 к distance", () => {
      const u10 = userStories.getStoryBy("U10");
      const ctxA = u10.contexts[0]!; // junior
      const ctxB = { ...u10.contexts[0]!, position: "senior" as const };

      const distance = privateMethods.trajectoryDistance(ctxA, ctxB, 12, 12);

      // positionDiff = 1, остальное = 0
      // (1 + 0 + 0 + 0) / 4 = 0.25
      expect(distance).toBe(0.25);
    });

    /**
     * TC-TS5b: Duration difference нормализуется по max
     *
     * Given:
     * - durationA = 12 месяцев
     * - durationB = 24 месяца
     *
     * Then:
     * - durationDiff = |12-24| / max(12,24) = 12/24 = 0.5
     * - Вклад в distance = 0.5 / 4 = 0.125
     */
    it("TC-TS5b: duration difference нормализуется по max", () => {
      const u10 = userStories.getStoryBy("U10");
      const ctx = u10.contexts[0]!;

      const distance = privateMethods.trajectoryDistance(ctx, ctx, 12, 24);

      // positionDiff = 0, durationDiff = 0.5, domainsDiff = 0, reasonsDiff = 0
      // (0 + 0.5 + 0 + 0) / 4 = 0.125
      expect(distance).toBeCloseTo(0.125, 5);
    });

    /**
     * TC-TS5c: Разные domains = Jaccard penalty
     */
    it("TC-TS5c: разные domains = Jaccard distance в компоненте", () => {
      const u10 = userStories.getStoryBy("U10");
      const ctxA = u10.contexts[0]!; // domains: ["backend"]
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test data override
      const frontendDomains = ["frontend"] as ("backend" | "frontend" | "fullstack" | "devops" | "qa")[];
      const ctxB = {
        ...u10.contexts[0]!,
        domains: frontendDomains,
      };

      const distance = privateMethods.trajectoryDistance(ctxA, ctxB, 12, 12);

      // positionDiff = 0, durationDiff = 0
      // domainsDiff = 1 (no overlap: backend vs frontend)
      // reasonsDiff = 0
      // (0 + 0 + 1 + 0) / 4 = 0.25
      expect(distance).toBe(0.25);
    });
  });

  describe("TC-TS6: Derivative calculation", () => {
    /**
     * TC-TS6: Derivative использует central difference для средних элементов
     *
     * Что тестируем:
     * Формула derivative: (arr[i+1] - arr[i-1]) / 2 для средних элементов.
     *
     * Given:
     * - series: [10, 20, 40, 50]
     *
     * Then:
     * - derivative[0] = 20 - 10 = 10 (forward)
     * - derivative[1] = (40 - 10) / 2 = 15 (central)
     * - derivative[2] = (50 - 20) / 2 = 15 (central)
     * - derivative[3] = 50 - 40 = 10 (backward)
     */
    it("TC-TS6: central difference для средних элементов", () => {
      const series = [10, 20, 40, 50];

      const result = privateMethods.derivative(series);

      expect(result).toEqual([10, 15, 15, 10]);
    });

    /**
     * TC-TS6b: Edge case — один элемент
     */
    it("TC-TS6b: один элемент = [0]", () => {
      const result = privateMethods.derivative([42]);

      expect(result).toEqual([0]);
    });
  });

  describe("TC-TS7: Path length validation", () => {
    /**
     * TC-TS7: Zero path length — защита от багов DTW библиотеки
     *
     * Что тестируем:
     * validatePathLength бросает ошибку если DTW вернул pathLength = 0.
     *
     * Бизнес-правило:
     * DTW path не может быть короче max(len1, len2).
     */
    it("TC-TS7: zero path length → throw", () => {
      expect(() => privateMethods.validatePathLength(0, 3, 3)).toThrow("DTW path length is zero");
    });

    /**
     * TC-TS7b: Path короче max trajectory → throw
     */
    it("TC-TS7b: path < max trajectory → throw", () => {
      expect(() => privateMethods.validatePathLength(2, 3, 4)).toThrow("less than max trajectory length");
    });
  });

  describe("TC-TS8: Хронологический порядок контекстов", () => {
    /**
     * TC-TS8: Non-chronological contexts → throw
     *
     * Что тестируем:
     * calculateDurationMonths проверяет что контексты упорядочены по времени.
     *
     * Бизнес-правило:
     * Траектория должна быть хронологической (first job → current).
     */
    it("TC-TS8: non-chronological → throw", () => {
      const u10 = userStories.getStoryBy("U10");
      const reversed = u10.contexts.toReversed(); // 2025 → 2023 → 2022

      expect(() => privateMethods.calculateDurationMonths(reversed)).toThrow("chronologically ordered");
    });
  });
});
