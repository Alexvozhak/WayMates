import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const bot = new Bot(token);

const DESCRIPTIONS = {
  en: `WayMates helps you discover career paths by analyzing real transitions of similar professionals.

Both started where you are now:
🎯 Pathfinders — already reached your goal
👥 Waymates — heading there with you

📺 Full workflow (via resume): youtu.be/z9M2QifhEfc
📺 Quick start: youtu.be/QpgWgkDxJ1A

👤 Author:
• linkedin.com/in/alexey-komarov-5b0b3b379
• github.com/Alexvozhak
• t.me/AlexKomarov1993
• alexvozhak@gmail.com`,

  ru: `WayMates помогает найти карьерный путь через анализ реальных переходов похожих профессионалов.

Оба начинали как ты:
🎯 Проводники — уже достигли твоей цели
👥 Попутчики — идут к ней вместе с тобой

📺 Полный флоу (через резюме): youtu.be/z9M2QifhEfc
📺 Быстрый старт: youtu.be/QpgWgkDxJ1A

👤 Автор:
• linkedin.com/in/alexey-komarov-5b0b3b379
• github.com/Alexvozhak
• t.me/AlexKomarov1993
• alexvozhak@gmail.com`,
};

const ABOUT = {
  en: "Find your career path through real transitions of similar professionals",
  ru: "Найди карьерный путь через реальные переходы похожих профессионалов",
};

async function main(): Promise<void> {
  console.log("Setting up bot profile...\n");

  // Set descriptions (visible before Start)
  console.log("📝 Setting descriptions...");
  await bot.api.setMyDescription(DESCRIPTIONS.en, { language_code: "en" });
  console.log("  ✅ English description set");

  await bot.api.setMyDescription(DESCRIPTIONS.ru, { language_code: "ru" });
  console.log("  ✅ Russian description set");

  // Set short descriptions (About in profile)
  console.log("\n📝 Setting short descriptions (About)...");
  await bot.api.setMyShortDescription(ABOUT.en, { language_code: "en" });
  console.log("  ✅ English about set");

  await bot.api.setMyShortDescription(ABOUT.ru, { language_code: "ru" });
  console.log("  ✅ Russian about set");

  // Set commands
  console.log("\n📝 Setting commands...");
  await bot.api.setMyCommands(
    [
      { command: "start", description: "Start bot" },
      { command: "help", description: "Get help" },
    ],
    { language_code: "en" },
  );
  console.log("  ✅ English commands set");

  await bot.api.setMyCommands(
    [
      { command: "start", description: "Начать" },
      { command: "help", description: "Помощь" },
    ],
    { language_code: "ru" },
  );
  console.log("  ✅ Russian commands set");

  console.log("\n✅ Bot profile setup complete!");
  console.log("\nVerify in Telegram: search for your bot and check profile.");
}

main().catch(console.error);
