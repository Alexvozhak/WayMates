import { readFile } from "node:fs/promises";
import path from "node:path";

import { DocumentNotFoundError } from "../errors.js";
import { getModel } from "../langGraph/shared-tools/models.js";

type DocType = "investor" | "tech" | "user";

const ARCHITECTURE_URL = "https://arch.waymates.duckdns.org";

const QA_SYSTEM_PROMPT = `You are WayMates project assistant. Answer the user's question based ONLY on the provided context.

Rules:
- Answer concisely in the same language as the question
- If the answer is not in the context, say "I don't have information about that"
- Do not make up information not present in the context
- Keep the answer focused and relevant to the question`;

export class DocumentaryService {
  constructor(private readonly docsPath: string) {}

  async answerInvestorQuestion(question: string): Promise<string> {
    const doc = await this.loadDoc("investor.md", "investor");
    return this.answerFromDoc(doc, question, true);
  }

  async answerTechQuestion(question: string): Promise<string> {
    const doc = await this.loadDoc("tech.md", "tech");
    return this.answerFromDoc(doc, question, true);
  }

  async answerUserQuestion(question: string): Promise<string> {
    const doc = await this.loadDoc("user.md", "user");
    return this.answerFromDoc(doc, question, false);
  }

  private async answerFromDoc(doc: string, question: string, includeArchLink: boolean): Promise<string> {
    const model = getModel("deterministic");
    const response = await model.invoke([
      { role: "system", content: QA_SYSTEM_PROMPT },
      { role: "user", content: `Context:\n${doc}\n\nQuestion: ${question}` },
    ]);
    const answer = String(response.content);
    return includeArchLink ? `${answer}\n\n📐 Architecture: ${ARCHITECTURE_URL}` : answer;
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
