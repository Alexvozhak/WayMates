/**
 * Вариант 2: LLM-as-User симулятор (Telegram TEST Environment)
 *
 * Плюсы: реалистичный диалог, впечатляет на демо, находит edge cases
 * Минусы: flaky, дороже, сложнее отлаживать
 *
 * ВАЖНО: Использует Telegram Test DC (не production!)
 * - Бот должен быть создан в Test Environment через @BotFather
 * - Session должна быть сгенерирована для Test DC
 *
 * Вывод будет выглядеть так:
 *
 * === Симуляция: Backend Developer ищет путь в ML ===
 * [Персона: Алексей, 28 лет, backend в Яндексе, хочет в ML]
 *
 * → USER: Привет! Хочу разобраться с карьерой
 * ← BOT:  Привет! Я помогу разобраться в карьерных переходах...
 *         Расскажите о себе — чем занимаетесь сейчас?
 * → USER: Работаю бэкендером в Яндексе уже 3 года. Python, FastAPI,
 *         PostgreSQL. Недавно прошёл курс по ML и загорелся этой темой.
 * ← BOT:  Отличный фундамент! Python — основной язык в ML...
 * → USER: Да, я уже поигрался с PyTorch на курсе. Сделал пару pet-проектов
 *         по компьютерному зрению. Но не уверен, хватит ли этого для перехода.
 * ← BOT:  Расскажите подробнее о pet-проектах...
 *
 * ✅ Диалог завершён (5 обменов, LLM считает что flow пройден)
 * 📊 Метрики: tokens=2340, cost=$0.012, duration=45s
 */

import bigInt from "big-integer";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Api, sessions, TelegramClient } from "telegram";

const { StringSession } = sessions;

// Test DC 2 (Amsterdam) — same as in generate-telegram-session.ts
const TEST_DC_ID = 2;
const TEST_DC_IP = "149.154.167.40";
const TEST_DC_PORT = 443;

// Персоны для симуляции — богаче чем в скриптах
const PERSONAS = [
  {
    name: "Backend Developer → ML",
    systemPrompt: `Ты Алексей, 28 лет, backend разработчик в Яндексе (3 года).
Твоя цель: понять как перейти в ML/AI.

Твой бэкграунд:
- Python, FastAPI, PostgreSQL — уверенно
- Прошёл курс ML на Coursera, сделал 2 pet-проекта по CV
- Математика — помнишь со времён института, но подзабыл

Как ты общаешься:
- Дружелюбно, но по делу
- Задаёшь уточняющие вопросы
- Делишься сомнениями ("не уверен, хватит ли...")
- Иногда используешь сленг ("поигрался с PyTorch")

Твоя задача: пройти диалог с карьерным ботом, рассказать о себе,
получить рекомендации. Веди себя как реальный человек.

Когда бот спросит достаточно и даст рекомендации — поблагодари и заверши.
Если чувствуешь что диалог завершён, напиши: [ЗАВЕРШЕНО]`,
  },
  {
    name: "Product Manager → CTO",
    systemPrompt: `Ты Мария, 32 года, Senior Product Manager в финтех стартапе (5 лет в продакт менеджменте).
Твоя цель: вырасти до CTO или VP of Product.

Твой бэкграунд:
- Запустила 3 продукта, один вырос до 1M MAU
- Управляла командой из 8 человек
- Техбэкграунд слабый — гуманитарное образование

Как ты общаешься:
- Уверенно, структурированно
- Мыслишь метриками и результатами
- Признаёшь свои слабые стороны открыто

Твоя задача: пройти диалог, получить план развития до CTO.
Когда диалог завершён, напиши: [ЗАВЕРШЕНО]`,
  },
];

// Bot username in Test Environment (create via @BotFather in test mode)
const BOT = process.env.TELEGRAM_TEST_BOT_USERNAME ?? "@waymates_test_bot";
const WAIT_MS = 10_000;
const MAX_EXCHANGES = 8;

type MessageType = Api.Message | Api.MessageService | Api.MessageEmpty;

async function simulateUser(client: TelegramClient, persona: (typeof PERSONAS)[0]): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`=== Симуляция: ${persona.name} ===`);
  console.log("=".repeat(60));
  console.log(`[Персона загружена, см. системный промпт]\n`);

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
  let userMessage = "Привет!";

  while (exchanges < MAX_EXCHANGES) {
    // Отправляем сообщение пользователя
    console.log(`→ USER: ${userMessage}`);
    await client.invoke(
      new Api.messages.SendMessage({
        peer: BOT,
        message: userMessage,
        randomId: bigInt(Math.floor(Math.random() * 1e15)),
      }),
    );

    conversationHistory.push(`USER: ${userMessage}`);

    // Ждём ответ бота
    await new Promise((r) => setTimeout(r, WAIT_MS));

    // Получаем ответ бота
    const history = await client.invoke(
      new Api.messages.GetHistory({
        peer: BOT,
        limit: 2,
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
      const botMsg = history.messages.find((m: MessageType) => m.className === "Message" && !("out" in m && m.out));
      if (botMsg && botMsg.className === "Message") {
        botResponse = botMsg.message ?? "";
      }
    }

    if (!botResponse) {
      console.log("← BOT:  (нет ответа, завершаем)");
      break;
    }

    // Форматируем вывод бота (многострочный)
    const botLines = botResponse.split("\n").filter((l) => l.trim());
    console.log(`← BOT:  ${botLines[0]?.slice(0, 70) ?? ""}...`);
    if (botLines.length > 1) {
      console.log(`        ${botLines[1]?.slice(0, 60) ?? ""}...`);
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

    // Считаем токены (приблизительно)
    totalTokens += (llmResponse.usage_metadata?.total_tokens ?? 0) || 500;

    // Проверяем завершение
    if (userMessage.includes("[ЗАВЕРШЕНО]")) {
      userMessage = userMessage.replace("[ЗАВЕРШЕНО]", "").trim();
      if (userMessage) {
        console.log(`→ USER: ${userMessage}`);
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
  const cost = ((totalTokens / 1_000_000) * 0.15).toFixed(3); // gpt-4o-mini pricing

  console.log(`\n✅ Диалог завершён (${exchanges} обменов)`);
  console.log(`📊 Метрики: ~${totalTokens} tokens, ~$${cost}, ${duration}s`);
}

async function main(): Promise<void> {
  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION ?? ""),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH ?? "",
    { connectionRetries: 5 },
  );

  // Connect to Test DC (must match session DC)
  client.session.setDC(TEST_DC_ID, TEST_DC_IP, TEST_DC_PORT);

  await client.connect();
  console.log("🚀 E2E Тестирование — Вариант 2: LLM-as-User");
  console.log(`📡 Test DC ${TEST_DC_ID} (${TEST_DC_IP})`);
  console.log(`🤖 Bot: ${BOT}\n`);

  // Запускаем только первую персону для демо
  await simulateUser(client, PERSONAS[0]!);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Симуляция завершена!");

  await client.disconnect();
}

main().catch(console.error);
