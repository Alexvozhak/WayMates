import { readFile } from "node:fs/promises";
import path from "node:path";

import { DocumentNotFoundError } from "../errors.js";
import { getModel } from "../langGraph/shared-tools/models.js";

const ARCHITECTURE_URL = "https://arch.waymates.duckdns.org";

const QA_SYSTEM_PROMPT = `You are WayMates project assistant. Answer the user's question based ONLY on the provided context.

Rules:
- Answer concisely in the same language as the question
- If the answer is not in the context, say "I don't have information about that"
- Do not make up information not present in the context
- Keep the answer focused and relevant to the question`;

export class DocumentaryService {
  constructor(private readonly docsPath: string) {}

  async answerAboutProject(question: string): Promise<string> {
    const doc = await this.loadDoc("about.md");
    return this.answerFromDoc(doc, question);
  }

  private async answerFromDoc(doc: string, question: string): Promise<string> {
    const model = getModel("deterministic");
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
