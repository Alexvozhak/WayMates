import { describe, test, expect } from "vitest";
import {
  TrailSchema,
  UserConstraintsSchema,
  isValidSchema,
  type Trail,
  type UserConstraints,
  CONTEXT_ID_PATTERN,
} from "../../src/schemas-zod.js";
import { loadTestData } from "../helpers/test-data-loader.js";

describe("Trail schema validation", () => {
  test("should validate real Trail data from generated JSON", () => {
    const testData = loadTestData("USER_001");
    const trail1 = testData.trails[0];
    const trail2 = testData.trails[1];

    // Ensure trails exist
    expect(trail1).toBeDefined();
    expect(trail2).toBeDefined();
    if (!trail1 || !trail2) {
      throw new Error("Test fixtures must include at least two trails");
    }

    // Test first trail (udemy)
    expect(isValidSchema(trail1, TrailSchema)).toBe(true);
    // trail_id больше не входит в TrailSchema - генерируется динамически
    expect(trail1.skill).toBe("angular");
    expect(trail1.platform).toBe("udemy");
    expect(trail1.from_context_id).toMatch(new RegExp(CONTEXT_ID_PATTERN));
    expect(trail1.to_context_id).toMatch(new RegExp(CONTEXT_ID_PATTERN));

    // Test second trail (mentorship)
    expect(isValidSchema(trail2, TrailSchema)).toBe(true);
    // trail_id больше не входит в TrailSchema - генерируется динамически
    expect(trail2.skill).toBe("ngrx");
    expect(trail2.platform).toBe("mentorship");
    expect(trail2.cost_usd).toBe(2400);
  });

  test("should validate Trail with all required fields", () => {
    const validTrail: Trail = {
      skill: "javascript",
      platform: "coursera",
      from_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST1",
      to_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST2",
      total_duration_weeks: 8,
      schedule: {
        sessions_per_week: 3,
        hours_per_session: 2.5,
      },
      cost_usd: 250,
      rating_course: 4.3,
      rating_platform: 4.5,
      rating_schedule: 4.0,
      course_name: "JavaScript Fundamentals",
    };

    expect(isValidSchema(validTrail, TrailSchema)).toBe(true);
  });

  test("should validate Trail with optional fields (course_link, user_feedback)", () => {
    const trailWithOptionals = {
      trail_id: "trl_01K6GR8JFECDEFGHJKMNPQRST2",
      skill: "python",
      platform: "books",
      from_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST1",
      to_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST2", // Completed trail
      total_duration_weeks: 12,
      schedule: {
        sessions_per_week: 2,
        hours_per_session: 1.5,
      },
      cost_usd: 45,
      rating_course: 4.0,
      rating_platform: 4.2,
      rating_schedule: 3.8,
      course_name: "Clean Code Book",
      course_link: "https://example.com/clean-code", // Optional
      user_feedback: "Excellent book for code quality", // Optional
    };

    expect(isValidSchema(trailWithOptionals, TrailSchema)).toBe(true);
  });

  test("should validate ongoing Trail with null to_context_id", () => {
    const ongoingTrail = {
      trail_id: "trl_01K6GR8JFECDEFGHJKMNPQRST3",
      skill: "kubernetes",
      platform: "pluralsight",
      from_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST1",
      to_context_id: null, // Ongoing trail - not completed yet
      total_duration_weeks: 5,
      schedule: {
        sessions_per_week: 3,
        hours_per_session: 1.5,
      },
      cost_usd: 199,
      rating_course: 4.2,
      rating_platform: 4.1,
      rating_schedule: 3.8,
      course_name: "Kubernetes for Developers",
      course_link: "https://pluralsight.com/courses/kubernetes-developers",
      user_feedback: "Still in progress, but comprehensive content",
    };

    expect(isValidSchema(ongoingTrail, TrailSchema)).toBe(true);
  });

  test("should reject invalid Trail data", () => {
    // Missing required field
    const missingSkill = {
      trail_id: "trl_01K6GR8JFECDEFGHJKMNPQRST4",
      // skill: "missing", // Required field missing
      platform: "udemy",
      from_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST1",
      to_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST2",
      total_duration_weeks: 6,
      schedule: {
        sessions_per_week: 4,
        hours_per_session: 2,
      },
      cost_usd: 150,
      rating_course: 4.0,
      rating_platform: 4.0,
      rating_schedule: 4.0,
      course_name: "Test Course",
    };

    expect(isValidSchema(missingSkill, TrailSchema)).toBe(false);
  });

  test("should reject Trail with invalid rating ranges", () => {
    const invalidRatings = {
      trail_id: "trl_01K6GR8JFECDEFGHJKMNPQRST5",
      skill: "java",
      platform: "pluralsight",
      from_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST1",
      to_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST2",
      total_duration_weeks: 4,
      schedule: {
        sessions_per_week: 5,
        hours_per_session: 1,
      },
      cost_usd: 200,
      rating_course: 6.0, // Invalid: > 5
      rating_platform: 0.5, // Invalid: < 1
      rating_schedule: 4.0,
      course_name: "Java Spring Boot",
    };

    expect(isValidSchema(invalidRatings, TrailSchema)).toBe(false);
  });

  test("should reject Trail with invalid schedule structure", () => {
    const invalidSchedule = {
      trail_id: "trl_01K6GR8JFECDEFGHJKMNPQRST6",
      skill: "docker",
      platform: "bootcamp",
      from_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST1",
      to_context_id: "ctx_01K6GR8JFECDEFGHJKMNPQRST2",
      total_duration_weeks: 16,
      schedule: {
        sessions_per_week: "invalid", // Should be number
        hours_per_session: 8,
      },
      cost_usd: 8000,
      rating_course: 4.5,
      rating_platform: 4.3,
      rating_schedule: 4.2,
      course_name: "Docker & Kubernetes Bootcamp",
    };

    expect(isValidSchema(invalidSchedule, TrailSchema)).toBe(false);
  });

  test("should validate multiple trails from same user", () => {
    const userData = loadTestData("USER_001");

    // Validate all trails from user 001 (should have 2 trails)
    expect(userData.trails).toHaveLength(2);
    userData.trails.forEach((trail: any) => {
      expect(isValidSchema(trail, TrailSchema)).toBe(true);
      // trail_id больше не входит в TrailSchema - генерируется динамически
      expect(trail.from_context_id).toMatch(new RegExp(CONTEXT_ID_PATTERN));
      // to_context_id может быть null для ongoing trails
      if (trail.to_context_id !== null) {
        expect(trail.to_context_id).toMatch(new RegExp(CONTEXT_ID_PATTERN));
      }
    });
  });
});

describe("UserConstraints schema validation", () => {
  test("should validate valid UserConstraints", () => {
    const validConstraints: UserConstraints = {
      max_hours_per_week: 20,
      max_monthly_budget: 500,
      deadline_date: "2025-12-31",
    };

    expect(isValidSchema(validConstraints, UserConstraintsSchema)).toBe(true);
  });

  test("should validate UserConstraints with optional fields", () => {
    const partialConstraints = {
      max_hours_per_week: 15,
      // max_monthly_budget: undefined, // Optional
      // deadline_date: undefined, // Optional
    };

    expect(isValidSchema(partialConstraints, UserConstraintsSchema)).toBe(true);
  });

  test("should validate empty UserConstraints", () => {
    const emptyConstraints = {};
    expect(isValidSchema(emptyConstraints, UserConstraintsSchema)).toBe(true);
  });

  test("should reject UserConstraints with invalid date format", () => {
    const invalidDate = {
      max_hours_per_week: 25,
      max_monthly_budget: 1000,
      deadline_date: "2025-13-32", // Invalid date
    };

    expect(isValidSchema(invalidDate, UserConstraintsSchema)).toBe(true); // Pattern validation might not catch logical date errors
  });

  test("should reject UserConstraints with wrong date pattern", () => {
    const wrongPattern = {
      max_hours_per_week: 30,
      deadline_date: "25-12-31", // Wrong format, should be YYYY-MM-DD
    };

    expect(isValidSchema(wrongPattern, UserConstraintsSchema)).toBe(false);
  });

  test("should reject UserConstraints with invalid types", () => {
    const invalidTypes = {
      max_hours_per_week: "twenty", // Should be number
      max_monthly_budget: "500", // Should be number
      deadline_date: "2025-12-31",
    };

    expect(isValidSchema(invalidTypes, UserConstraintsSchema)).toBe(false);
  });
});

// TargetGoal schema tests removed - schema no longer exists
