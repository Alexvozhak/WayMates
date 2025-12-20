import { readFile } from "node:fs/promises";
import path from "node:path";

import { DocumentNotFoundError } from "../errors.js";

type DocType = "investor" | "tech" | "user";

export class DocumentaryService {
  constructor(private readonly docsPath: string) {}

  async getInvestorPitch(): Promise<string> {
    return this.loadDoc("investor.md", "investor");
  }

  async getTechOverview(): Promise<string> {
    return this.loadDoc("tech.md", "tech");
  }

  async getUserInfo(): Promise<string> {
    return this.loadDoc("user.md", "user");
  }

  private async loadDoc(filename: string, docType: DocType): Promise<string> {
    const fullPath = path.join(this.docsPath, filename);
    try {
      return await readFile(fullPath, "utf8");
    } catch {
      throw new DocumentNotFoundError(docType);
    }
  }
}
