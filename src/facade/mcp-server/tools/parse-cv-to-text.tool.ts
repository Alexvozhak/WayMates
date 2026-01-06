import OpenAI from "openai";

import { mcpParseCvToTextParamsSchema } from "../../../shared/schemas.js";
import { config } from "../../env.js";
import { ValidationError } from "../../errors.js";

import { BaseTool } from "./base-tool.js";

import type { BaseToolDependencies } from "./base-tool.js";
import type { McpParseCvToTextParams, ParseCvToTextResponse, UserId } from "../../../shared/schemas.js";

export class ParseCvToTextTool extends BaseTool<McpParseCvToTextParams, ParseCvToTextResponse> {
  private readonly maxFileSizeBytes = config.CV_PARSER_MAX_FILE_SIZE_MB * 1024 * 1024;

  private readonly openrouter = new OpenAI({
    baseURL: config.OPENAI_API_BASE,
    apiKey: config.OPENAI_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://waymates.ai",
      "X-Title": "WayMates Resume Parser",
    },
  });

  private readonly systemPrompt = `Convert this resume/CV to ANONYMIZED structured markdown for a career transition platform.

EXTRACTION ORDER: Process the document systematically to ensure completeness.
1. First, scan the ENTIRE document and identify ALL work positions mentioned
2. Order positions chronologically from OLDEST (earliest start date) to NEWEST (most recent)
3. Extract and format EACH position - do not skip any, especially older/earlier roles
4. Verify you have captured every position before finishing

CRITICAL: This is an anonymous platform. DO NOT extract:
- Names (first name, last name, any personal names)
- Email addresses
- Phone numbers
- Company names (replace with industry + size)
- URLs to personal profiles (LinkedIn, GitHub, etc.)
- Any personally identifiable information

IMPORTANT: Skills MUST be distributed per position, NOT in a separate section.
- Look at the "Skills" section and assign each skill to the position(s) where it was actually used
- If a skill appears in job description bullets, include it in that position's skills
- If skill is listed generally, assign it to the most recent position where it could have been used
- DO NOT create a separate "Skills and Technologies" section at the end

Include (ANONYMIZED):
- Work experience: position title, industry type, company size, dates, skills used IN THAT ROLE
- Education: degree level, field of study, year (NO university names)
- Certifications and courses (skill names, platforms, NO personal details)
- Languages spoken (if mentioned)
- Location: country and city only
- Citizenship (if mentioned)

Format requirements:
- Use clear markdown headers (## for each position)
- For work experience: "## Position Title (Start Year - End Year)"
- Under each position add: "Industry: [type], Company Size: [size], Location: [city, country]"
- Under each position add: "Skills: [list of skills used in THIS specific role]"
- Replace company names with descriptions like "Large Tech Company", "Mid-size Fintech", "Startup in E-commerce"
- Keep original language (do not translate)

Example format:
## Senior Backend Engineer (2020 - 2023)
Industry: Fintech, Company Size: 50-200, Location: Moscow, Russia
Skills: Python, PostgreSQL, Kubernetes, Docker
- Developed high-load payment processing systems
- Led team of 5 developers

## Junior Developer (2018 - 2020)
Industry: E-commerce, Company Size: 10-50, Location: Moscow, Russia
Skills: JavaScript, React, Node.js
- Built frontend components
- Maintained REST APIs

Output ONLY the anonymized markdown, no meta-commentary.`;

  constructor(deps: BaseToolDependencies) {
    super(deps, mcpParseCvToTextParamsSchema);
  }

  protected async executeImpl(params: McpParseCvToTextParams, _userId: UserId): Promise<ParseCvToTextResponse> {
    // Validate file size
    const fileSizeBytes = Buffer.byteLength(params.fileBuffer, "base64");
    if (fileSizeBytes > this.maxFileSizeBytes) {
      const maxMb = config.CV_PARSER_MAX_FILE_SIZE_MB;
      const actualMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);
      throw new ValidationError(`File too large: ${actualMb}MB exceeds limit of ${maxMb}MB`);
    }

    // Validate PDF format (check magic bytes)
    const pdfMagicBytes = "JVBERi"; // Base64 of "%PDF-"
    if (!params.fileBuffer.startsWith(pdfMagicBytes)) {
      throw new ValidationError("Invalid file format: only PDF files are supported");
    }

    const response = await this.openrouter.chat.completions.create({
      model: config.CV_PARSER_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: this.systemPrompt,
            },
            {
              type: "image_url",

              image_url: {
                url: `data:application/pdf;base64,${params.fileBuffer}`,
              },
            },
          ],
        },
      ],
      temperature: config.CV_PARSER_TEMPERATURE,

      max_tokens: config.CV_PARSER_MAX_OUTPUT_TOKENS,
    });

    const parsedText = response.choices[0]?.message?.content;

    if (!parsedText) {
      throw new ValidationError("Failed to parse resume: empty response from Gemini");
    }

    return {
      text: parsedText,
    };
  }
}
