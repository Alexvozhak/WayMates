import { CoreApiError } from './tools/base-tool.js';

import type { AxiosInstance } from 'axios';


export class CoreRestClient {
  constructor(private httpClient: AxiosInstance) {}

  async get<T>(path: string): Promise<T> {
    try {
      const { data } = await this.httpClient.get<T>(path);
      return data;
    } catch (error) {
      throw new CoreApiError(
        `Core API GET ${path} failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.httpClient.post<T>(path, body);
      return data;
    } catch (error) {
      throw new CoreApiError(
        `Core API POST ${path} failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    try {
      const { data } = await this.httpClient.patch<T>(path, body);
      return data;
    } catch (error) {
      throw new CoreApiError(
        `Core API PATCH ${path} failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
