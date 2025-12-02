import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

import { CoreApiError } from "../errors.js";

import type { AppRouter } from "../../shared/types.js";

export class CoreTRPCClient {
  private trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>>;

  constructor(coreUrl: string) {
    this.trpc = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: coreUrl,
        }),
      ],
    });
  }

  get client(): ReturnType<typeof createTRPCProxyClient<AppRouter>> {
    return this.trpc;
  }

  async withErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new CoreApiError(`Core API ${context} failed: ${this.getErrorMessage(error)}`);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
