import { z } from 'zod';
import type { ValidationResult } from './types.js';

export function handleValidationError<T>(
  error: unknown,
  attempt: number,
  maxRetries: number
): ValidationResult<T> | null {
  if (error instanceof z.ZodError) {
    const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    const missingFields = error.errors
      .filter((e) => e.code === 'invalid_type')
      .map((e) => e.path.join('.'));

    if (attempt === maxRetries) {
      return { success: false, errors, missingFields };
    }
    return null;
  }

  if (error instanceof SyntaxError && attempt === maxRetries) {
    return { success: false, errors: ['Invalid JSON response from LLM'] };
  }

  if (attempt === maxRetries) {
    throw error;
  }

  return null;
}

export async function retryWithValidation<T>(
  fn: () => Promise<unknown>,
  schema: z.ZodSchema<T>,
  maxRetries: number = 2
): Promise<ValidationResult<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, data: schema.parse(result) };
    } catch (error) {
      lastError = error;
    }
  }

  return createErrorResult<T>(lastError);
}

function createErrorResult<T>(error: unknown): ValidationResult<T> {
  if (error instanceof z.ZodError) {
    const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    const missingFields = error.errors
      .filter((e) => e.code === 'invalid_type')
      .map((e) => e.path.join('.'));
    return { success: false, errors, missingFields };
  }

  if (error instanceof SyntaxError) {
    return { success: false, errors: ['Invalid JSON response from LLM'] };
  }

  throw error;
}
