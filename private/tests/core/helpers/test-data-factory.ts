import type { UserContext } from "@shared/schemas.js";

/**
 * Create minimal valid UserContext for tests
 * Provide only fields you want to test, others filled with defaults
 */
export function createTestContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    contextId: "ctx_test_123",
    previousContextId: null,
    nextContextId: null,
    createdAt: "2025-01-01T00:00:00Z",
    creationReason: ["started_working"],
    position: "Junior Developer",
    role: "developer",
    domains: ["Backend"],
    skills: ["javascript"],
    industry: "tech",
    companySize: "startup",
    countryCode: "us",
    cityName: "San Francisco",
    citizenships: ["us"],
    birthYear: 1995,
    educationLevel: null,
    salaryExact: null,
    salaryMin: null,
    salaryMax: null,
    languages: null,
    feedback: null,
    ...overrides,
  };
}
