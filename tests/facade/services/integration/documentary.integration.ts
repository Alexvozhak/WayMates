import { describe, it, expect } from "vitest";

import { DocumentaryService } from "../../../../src/facade/services/documentary.service.js";
import { DocumentNotFoundError } from "../../../../src/facade/errors.js";

describe("DocumentaryService Integration Tests", () => {
  const service = new DocumentaryService("./docs/presentation");

  /**
   * TC-DOC1: getInvestorPitch returns investor.md content
   *
   * Что тестируем:
   * DocumentaryService корректно читает investor.md и возвращает контент
   * для инвесторов/акселераторов.
   *
   * Given:
   * - docs/presentation/investor.md существует
   *
   * Then:
   * - Контент содержит ключевые фразы: "Career Navigation", "DTW", "Pathfinder"
   *
   * Тип теста: Integration (fs read)
   */
  it("TC-DOC1: getInvestorPitch returns investor document with key phrases", async () => {
    const content = await service.getInvestorPitch();

    expect(content).toContain('Career transitions are a **"leap of faith"** today');
    expect(content).toContain("Graph of real career transitions + trajectory matching");
    expect(content).toContain("User sets goal → we show **Pathfinders** (achieved it) and **Waymates** (going there)");
  });

  /**
   * TC-DOC2: getTechOverview returns tech.md content
   *
   * Что тестируем:
   * DocumentaryService корректно читает tech.md для техлидов/работодателей.
   *
   * Given:
   * - docs/presentation/tech.md существует
   *
   * Then:
   * - Контент содержит ключевые фразы: "Neo4j", "LangGraph", "ESLint"
   *
   * Тип теста: Integration (fs read)
   */
  it("TC-DOC2: getTechOverview returns tech document with key phrases", async () => {
    const content = await service.getTechOverview();

    expect(content).toContain("**Users** with career trajectories (ordered chain of Contexts)");
    expect(content).toContain("**Cold-Start Agent** — multi-turn conversation to collect career history");
    expect(content).toContain("`max-depth: 2` — max 2 nesting levels");
  });

  /**
   * TC-DOC3: getUserInfo returns user.md content
   *
   * Что тестируем:
   * DocumentaryService корректно читает user.md для конечных пользователей.
   *
   * Given:
   * - docs/presentation/user.md существует
   *
   * Then:
   * - Контент содержит ключевые фразы: "Pathfinder", "Waymate", "Cold Start"
   *
   * Тип теста: Integration (fs read)
   */
  it("TC-DOC3: getUserInfo returns user document with key phrases", async () => {
    const content = await service.getUserInfo();

    expect(content).toContain("| **Pathfinder** | Someone who already achieved your career goal |");
    expect(content).toContain("| **Waymate**    | Someone going towards the same goal as you    |");
    expect(content).toContain("### 1. Cold Start (Полная история)");
  });

  /**
   * TC-DOC4: throws DocumentNotFoundError for missing file
   *
   * Что тестируем:
   * При отсутствии файла бросается типизированная ошибка DocumentNotFoundError.
   *
   * Given:
   * - Сервис с несуществующим путём
   *
   * Then:
   * - Бросается DocumentNotFoundError
   *
   * Тип теста: Integration (fs read error)
   */
  it("TC-DOC4: throws DocumentNotFoundError for missing file", async () => {
    const badService = new DocumentaryService("./nonexistent/path");

    await expect(badService.getTechOverview()).rejects.toThrow(DocumentNotFoundError);
  });
});
