import { BaseTool } from "./base-tool.js";

import type { Dictionaries, UserId } from "../../../shared/schemas.js";
import type { SessionId } from "../result.js";
import type { GetDictionariesParams } from "../schemas.js";

export class GetDictionariesTool extends BaseTool<GetDictionariesParams, Dictionaries> {
  protected extractSessionId(params: GetDictionariesParams): SessionId {
    return params.sessionId;
  }

  protected async executeImpl(
    _params: GetDictionariesParams,
    _userId: UserId,
  ): Promise<Dictionaries> {
    return this.coreClient.client.dictionaries.getVerified.query();
  }
}
