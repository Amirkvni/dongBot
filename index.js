const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const app = express();

const token = "8344521445:AAEQOldx12LoMOji6YfC91omb058bN5t-MY"; // توکن رو مستقیم اینجا بذار
const bot = new TelegramBot(token);

// دامنه سرویس روی Render رو مستقیم اینجا بنویس
const url = "https://dongbot-1.onrender.com";

// تنظیم Webhook
bot.setWebHook(`${url}/bot${token}`);

app.use(express.json());

// روت دریافت پیام‌ها از تلگرام
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// منطق پاسخ به پیام‌ها
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "سلام! مبلغ کل رو بفرست:");

  bot.once("message", (msg1) => {
    const total = Number(msg1.text);
    if (isNaN(total)) return bot.sendMessage(chatId, "مبلغ نامعتبره!");

    bot.sendMessage(chatId, "تعداد نفرات؟");

    bot.once("message", (msg2) => {
      const count = Number(msg2.text);
      if (isNaN(count) || count === 0)
        return bot.sendMessage(chatId, "تعداد نفر نامعتبره!");

      const share = total / count;
      bot.sendMessage(chatId, `سهم هر نفر: ${share.toFixed(0)} تومان`);
    });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
