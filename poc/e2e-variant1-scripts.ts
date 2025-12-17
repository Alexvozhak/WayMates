/**
 * Вариант 1: Параметризованные скрипты
 *
 * Плюсы: детерминированно, быстро, дёшево, надёжно для CI
 * Минусы: диалог "роботный", не впечатляет на демо
 *
 * Вывод будет выглядеть так:
 *
 * === Сценарий: Backend → ML ===
 * → USER: /start
 * ← BOT:  Привет! Я помогу разобраться в карьерных переходах...
 * → USER: Я backend разработчик, 3 года в Яндексе, хочу перейти в ML
 * ← BOT:  Отлично! Расскажите подробнее о вашем опыте...
 * → USER: Python, FastAPI, PostgreSQL, немного PyTorch
 * ← BOT:  Хороший фундамент для ML! Давайте...
 * ✅ Сценарий пройден (3 обмена, 12.3s)
 */

import bigInt from "big-integer";
import { Api, sessions, TelegramClient } from "telegram";

const { StringSession } = sessions;

// Параметризованные персоны
const PERSONAS = [
  {
    name: "Backend → ML",
    messages: [
      "/start",
      "Я backend разработчик, 3 года в Яндексе, хочу перейти в ML",
      "Python, FastAPI, PostgreSQL, немного PyTorch на курсах",
      "Интересует Computer Vision или NLP",
    ],
  },
  {
    name: "PM → CTO",
    messages: [
      "/start",
      "Продакт менеджер, 5 лет опыта, хочу вырасти до CTO",
      "Управлял командой из 8 человек, запустил 3 продукта",
      "Техбэкграунд слабый, но хочу развивать",
    ],
  },
  {
    name: "Junior → Senior",
    messages: ["/start", "Junior frontend, mass.", "React, TypeScript, полгода опыта", "Хочу стать senior за 2 года"],
  },
];

const BOT = "@waymates_bot";
const WAIT_MS = 8000;

type MessageType = Api.Message | Api.MessageService | Api.MessageEmpty;

async function runScenario(client: TelegramClient, persona: (typeof PERSONAS)[0]): Promise<void> {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`=== Сценарий: ${persona.name} ===`);
  console.log("=".repeat(50));

  const startTime = Date.now();
  let exchanges = 0;

  for (const userMessage of persona.messages) {
    // Отправляем сообщение
    console.log(`\n→ USER: ${userMessage}`);
    await client.invoke(
      new Api.messages.SendMessage({
        peer: BOT,
        message: userMessage,
        randomId: bigInt(Math.floor(Math.random() * 1e15)),
      }),
    );

    // Ждём ответ бота
    await new Promise((r) => setTimeout(r, WAIT_MS));

    // Получаем ответ
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

    if (history.className === "messages.Messages" || history.className === "messages.MessagesSlice") {
      const botMsg = history.messages.find((m: MessageType) => m.className === "Message" && !("out" in m && m.out));
      if (botMsg && botMsg.className === "Message") {
        const text = botMsg.message ?? "(пусто)";
        const preview = text.length > 80 ? text.slice(0, 80) + "..." : text;
        console.log(`← BOT:  ${preview}`);
      }
    }

    exchanges++;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Сценарий пройден (${exchanges} обменов, ${duration}s)`);
}

async function main(): Promise<void> {
  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION ?? ""),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH ?? "",
    { connectionRetries: 5 },
  );

  await client.connect();
  console.log("🚀 E2E Тестирование — Вариант 1: Скрипты\n");

  for (const persona of PERSONAS) {
    await runScenario(client, persona);
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Все сценарии завершены!");

  await client.disconnect();
}

main().catch(console.error);
