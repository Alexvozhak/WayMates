import type { OpenAI } from 'openai';

export interface MapperContext {
  openai: OpenAI;
  userId: string;
  query: string;
  systemPrompt: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[]; missingFields?: string[] };

export interface MapperOptions {
  maxRetries?: number;
  temperature?: number;
}
