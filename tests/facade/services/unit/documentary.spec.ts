import { describe, it, expect } from "vitest";

import { DocumentaryService } from "../../../../src/facade/services/documentary.service.js";
import { DocumentNotFoundError } from "../../../../src/facade/errors.js";

describe("DocumentaryService Integration Tests", () => {
  const service = new DocumentaryService("./docs/presentation");

  /**
   * TC-DOC1: answerInvestorQuestion returns LLM-generated answer about business model
   *
   * Что тестируем:
   * LLM читает investor.md и отвечает на вопрос о бизнес-модели.
   *
   * Given:
   * - docs/presentation/investor.md содержит раздел "Business Model"
   * - Вопрос: "What is the business model?"
   *
   * Then:
   * - Ответ содержит ключевые слова: "freemium" или "premium", "B2C" или "B2B"
   *
   * Тип теста: Integration (LLM + fs read)
   */
  it("TC-DOC1: answerInvestorQuestion returns LLM answer about business model", async () => {
    const answer = await service.answerInvestorQuestion("What is the business model?");

    const lowerAnswer = answer.toLowerCase();
    expect(lowerAnswer).toMatch(/freemium|premium|b2c|b2b/);
  });

  /**
   * TC-DOC2: answerTechQuestion returns LLM-generated answer about tech stack
   *
   * Что тестируем:
   * LLM читает tech.md и отвечает на вопрос о технологиях.
   *
   * Given:
   * - docs/presentation/tech.md содержит раздел "Tech Stack"
   * - Вопрос: "What database is used?"
   *
   * Then:
   * - Ответ содержит ключевое слово: "neo4j"
   *
   * Тип теста: Integration (LLM + fs read)
   */
  it("TC-DOC2: answerTechQuestion returns LLM answer about database", async () => {
    const answer = await service.answerTechQuestion("What database is used?");

    const lowerAnswer = answer.toLowerCase();
    expect(lowerAnswer).toContain("neo4j");
  });

  /**
   * TC-DOC3: answerUserQuestion returns LLM-generated answer about Pathfinder concept
   *
   * Что тестируем:
   * LLM читает user.md и отвечает на вопрос о концепции Pathfinder.
   *
   * Given:
   * - docs/presentation/user.md содержит определение Pathfinder
   * - Вопрос: "What is a Pathfinder?"
   *
   * Then:
   * - Ответ содержит ключевые слова: "goal" или "achieved"
   *
   * Тип теста: Integration (LLM + fs read)
   */
  it("TC-DOC3: answerUserQuestion returns LLM answer about Pathfinder", async () => {
    const answer = await service.answerUserQuestion("What is a Pathfinder?");

    const lowerAnswer = answer.toLowerCase();
    expect(lowerAnswer).toMatch(/goal|achieved|career/);
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

    await expect(badService.answerTechQuestion("What is this?")).rejects.toThrow(DocumentNotFoundError);
  });

  /**
   * TC-DOC5: returns "don't have information" for question not covered by document
   *
   * Что тестируем:
   * LLM честно отвечает, что информации нет, если вопрос не покрыт документом.
   *
   * Given:
   * - docs/presentation/investor.md не содержит информацию о погоде
   * - Вопрос: "What is the weather in Moscow?"
   *
   * Then:
   * - Ответ содержит "don't have" или "no information" или аналог
   *
   * Тип теста: Integration (LLM + fs read)
   */
  it("TC-DOC5: returns 'don't have information' for unrelated question", async () => {
    const answer = await service.answerInvestorQuestion("What is the weather in Moscow today?");

    const lowerAnswer = answer.toLowerCase();
    expect(lowerAnswer).toMatch(/don't have|no information|not in the context|cannot find|not available/);
  });
});
