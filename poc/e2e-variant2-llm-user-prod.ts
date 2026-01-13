/**
 * Вариант 2: LLM-as-User симулятор (Production Telegram)
 *
 * Отправляет сообщения боту через GramJS, LLM генерирует ответы "пользователя".
 *
 * Env vars needed:
 *   TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
 *   TELEGRAM_BOT_USERNAME (default: @WayMates_bot)
 *   OPENROUTER_API_KEY
 */

import bigInt from "big-integer";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Api, sessions, TelegramClient } from "telegram";

const { StringSession } = sessions;

// Персоны для симуляции
const PERSONAS = [
  {
    name: "Backend Developer → ML",
    systemPrompt: `Ты Алексей, 28 лет, backend разработчик в Яндексе (3 года).
Твоя цель: понять как перейти в ML/AI.

Твой бэкграунд:
- Python, FastAPI, PostgreSQL — уверенно
- Прошёл курс ML на Coursera, сделал 2 pet-проекта по CV
- Математика — помнишь со времён института, но подзабыл

КРИТИЧЕСКИ ВАЖНО — формат ответов:
- Если бот предлагает команды (например /story, /by_target), отправь ТОЛЬКО команду
- Команда — это РОВНО "/слово" без пробелов, комментариев, пояснений
- Правильно: /story
- Неправильно: /story — расскажу свою историю
- Неправильно: Выбираю /story
- Неправильно: / story (пробел после слеша)
- Свободный текст пиши ТОЛЬКО когда бот задаёт открытый вопрос

Как ты общаешься (в свободном тексте):
- Дружелюбно, но по делу
- Коротко — 1-2 предложения
- Делишься сомнениями ("не уверен, хватит ли...")

Твоя задача: пройти диалог с карьерным ботом через /story.
Когда бот даст рекомендации — поблагодари и напиши: [ЗАВЕРШЕНО]`,
  },
];

const BOT = process.env.TELEGRAM_BOT_USERNAME ?? "@WayMates_bot";
const WAIT_MS = 15_000; // 15 sec for LLM processing
const MAX_EXCHANGES = 8;

type MessageType = Api.Message | Api.MessageService | Api.MessageEmpty;

async function simulateUser(client: TelegramClient, persona: (typeof PERSONAS)[0]): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== Симуляция: ${persona.name} ===`);
  console.log("=".repeat(60));
  console.log(`[Персона загружена]\n`);

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });

  const conversationHistory: string[] = [];
  let exchanges = 0;
  let totalTokens = 0;
  const startTime = Date.now();

  // Начинаем диалог
  let userMessage = "/start";

  while (exchanges < MAX_EXCHANGES) {
    // Отправляем сообщение пользователя
    console.log(`\n→ USER: ${userMessage}`);
    await client.invoke(
      new Api.messages.SendMessage({
        peer: BOT,
        message: userMessage,
        randomId: bigInt(Math.floor(Math.random() * 1e15)),
      }),
    );

    conversationHistory.push(`USER: ${userMessage}`);

    // Ждём ответ бота
    console.log(`   (ждём ${WAIT_MS / 1000}s...)`);
    await new Promise((r) => setTimeout(r, WAIT_MS));

    // Получаем ответ бота
    const history = await client.invoke(
      new Api.messages.GetHistory({
        peer: BOT,
        limit: 5,
        offsetId: 0,
        offsetDate: 0,
        addOffset: 0,
        maxId: 0,
        minId: 0,
        hash: bigInt(0),
      }),
    );

    let botResponse = "";
    if (history.className === "messages.Messages" || history.className === "messages.MessagesSlice") {
      // Find last bot message (not from us)
      const botMsg = history.messages.find((m: MessageType) => m.className === "Message" && !("out" in m && m.out));
      if (botMsg && botMsg.className === "Message") {
        botResponse = botMsg.message ?? "";
      }
    }

    if (!botResponse) {
      console.log("← BOT:  (нет ответа, завершаем)");
      break;
    }

    // Форматируем вывод бота
    const botLines = botResponse.split("\n").filter((l) => l.trim());
    console.log(`← BOT:  ${botLines[0]?.slice(0, 70) ?? ""}`);
    for (const line of botLines.slice(1, 4)) {
      console.log(`        ${line.slice(0, 65)}`);
    }
    if (botLines.length > 4) {
      console.log(`        ... (ещё ${botLines.length - 4} строк)`);
    }

    conversationHistory.push(`BOT: ${botResponse}`);
    exchanges++;

    // Генерируем ответ "пользователя" через LLM
    const llmResponse = await llm.invoke([
      new SystemMessage(persona.systemPrompt),
      new HumanMessage(
        `История диалога:\n${conversationHistory.join("\n")}\n\nЧто ты ответишь боту? Отвечай от первого лица, коротко (1-3 предложения).`,
      ),
    ]);

    userMessage = typeof llmResponse.content === "string" ? llmResponse.content : String(llmResponse.content);

    totalTokens += (llmResponse.usage_metadata?.total_tokens ?? 0) || 500;

    // Проверяем завершение
    if (userMessage.includes("[ЗАВЕРШЕНО]")) {
      userMessage = userMessage.replace("[ЗАВЕРШЕНО]", "").trim();
      if (userMessage) {
        console.log(`\n→ USER: ${userMessage}`);
        await client.invoke(
          new Api.messages.SendMessage({
            peer: BOT,
            message: userMessage,
            randomId: bigInt(Math.floor(Math.random() * 1e15)),
          }),
        );
      }
      break;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(0);
  const cost = ((totalTokens / 1_000_000) * 0.15).toFixed(3);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Диалог завершён (${exchanges} обменов)`);
  console.log(`📊 Метрики: ~${totalTokens} tokens, ~$${cost}, ${duration}s`);
}

async function main(): Promise<void> {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;

  if (!apiId || !apiHash || !session) {
    console.error("Missing: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION");
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("Missing: OPENROUTER_API_KEY");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(session), Number(apiId), apiHash, { connectionRetries: 5 });

  await client.connect();
  console.log("🚀 E2E Тестирование — LLM-as-User (Production)");
  console.log(`🤖 Bot: ${BOT}\n`);

  await simulateUser(client, PERSONAS[0]!);

  console.log("\n🎉 Симуляция завершена!");
  await client.disconnect();
}

main().catch(console.error);
