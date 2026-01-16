import { readFile } from "node:fs/promises";
import path from "node:path";

import { DocumentNotFoundError } from "../errors.js";
import { getModel } from "../langGraph/shared-tools/models.js";

const ARCHITECTURE_URL = "https://arch.waymates.duckdns.org";

const QA_SYSTEM_PROMPT = `You are WayMates project assistant. Answer the user's question based on the provided context.

Rules:
- If part of the question is not covered, answer what you can and briefly note what's missing
- Do not invent specific facts not in the context
- Be helpful and conversational`;

export class DocumentaryService {
  constructor(private readonly docsPath: string) {}

  async answerAboutProject(question: string): Promise<string> {
    const doc = await this.loadDoc("about.md");
    return this.answerFromDoc(doc, question);
  }

  private async answerFromDoc(doc: string, question: string): Promise<string> {
    const model = getModel("conversational");
    const response = await model.invoke([
      { role: "system", content: QA_SYSTEM_PROMPT },
      { role: "user", content: `Context:\n${doc}\n\nQuestion: ${question}` },
    ]);
    const answer = String(response.content);
    return `${answer}\n\n📐 Architecture: ${ARCHITECTURE_URL}`;
  }

  private async loadDoc(filename: string): Promise<string> {
    const fullPath = path.join(this.docsPath, filename);
    try {
      return await readFile(fullPath, "utf8");
    } catch {
      throw new DocumentNotFoundError("about");
    }
  }
}
