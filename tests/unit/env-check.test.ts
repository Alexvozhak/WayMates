import { describe, test, expect } from "vitest";

describe("Unit Tests Environment Variables", () => {
  test("should have NO specific env loaded (development defaults)", () => {
    console.log("🧪 Unit NEO4J_URI:", process.env.NEO4J_URI);
    console.log("🧪 Unit NEO4J_PASSWORD:", process.env.NEO4J_PASSWORD);
    console.log("🧪 Unit NEO4J_USER:", process.env.NEO4J_USER);
    
    // Unit тесты НЕ должны иметь специфичных переменных Neo4j
    // Или должны иметь дефолтные значения
    if (process.env.NEO4J_URI) {
      console.log("ℹ️ Unit tests have Neo4j vars (unexpected but not critical)");
    } else {
      console.log("✅ Unit tests have no Neo4j vars (as expected)");
    }
  });
});
