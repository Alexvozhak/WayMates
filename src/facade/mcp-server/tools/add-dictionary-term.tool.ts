import { BaseTool } from "./base-tool.js";

import type { UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { AddDictionaryTermParams } from "../schemas.js";

export class AddDictionaryTermTool extends BaseTool<AddDictionaryTermParams, void> {
  protected extractSessionId(params: AddDictionaryTermParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(params: AddDictionaryTermParams, userId: UserId): Promise<void> {
    await this.coreClient.client.dictionaries.addTerm.mutate({
      ...params.term,
      createdBy: userId,
    });
  }
}
