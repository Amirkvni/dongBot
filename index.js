const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const app = express();

const token = "8344521445:AAEQOldx12LoMOji6YfC91omb058bN5t-MY";
const bot = new TelegramBot(token);
bot.setWebHook(`https://dongbot-1.onrender.com/bot${token}`);

app.use(express.json());

app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const sessions = new Map();

// تبدیل اعداد فارسی به انگلیسی
function toEnDigits(str) {
  return str.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sessions.set(chatId, {
    step: "waiting_count",
    names: [],
    costs: [],
  });

  bot.sendMessage(
    chatId,
    "سلام به ربات دُنگ‌باز خوش اومدین! 👋\n\nچند نفر هستید؟"
  );
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) return;
  if (msg.text.startsWith("/start")) return; // برای جلوگیری از تداخل

  const text = toEnDigits(msg.text.trim());

  if (session.step === "waiting_count") {
    const count = parseInt(text);
    if (isNaN(count) || count < 1)
      return bot.sendMessage(
        chatId,
        "تعداد نامعتبره. لطفاً عددی صحیح وارد کن."
      );

    session.totalCount = count;
    session.step = "waiting_names";
    session.names = [];
    bot.sendMessage(chatId, `اسم نفر اول رو وارد کن:`);
    return;
  }

  if (session.step === "waiting_names") {
    if (session.names.includes(text))
      return bot.sendMessage(chatId, "اسم تکراریه، لطفاً یه اسم دیگه وارد کن.");

    session.names.push(text);

    if (session.names.length < session.totalCount) {
      bot.sendMessage(chatId, `اسم نفر بعدی رو وارد کن:`);
    } else {
      session.step = "waiting_costs";
      session.costs = [];

      bot.sendMessage(
        chatId,
        `✅ افراد: ${session.names.join(
          " - "
        )}\n\nالان هزینه‌ها رو با فرمت زیر وارد کن:\n\nنام پرداخت‌کننده - دلیل - مقدار پرداختی - استفاده‌کننده‌ها\n\nمثال:\nشایان-شام-10000-امیر-کسرا-شایان-شاهین\n\nبرای پایان، بنویس: پایان`
      );

      // دکمه نمایش همه هزینه‌ها
      bot.sendMessage(chatId, "برای دیدن همه هزینه‌ها روی دکمه زیر بزن:", {
        reply_markup: {
          keyboard: [["نمایش همه هزینه‌ها"]],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      });
    }
    return;
  }

  if (session.step === "waiting_costs") {
    if (text === "پایان") {
      session.step = "done";
      bot.sendMessage(
        chatId,
        "ورود هزینه‌ها پایان یافت. می‌تونی با دکمه‌ها کار رو ادامه بدی."
      );
      return;
    }

    if (text === "نمایش همه هزینه‌ها") {
      if (!session.costs || session.costs.length === 0) {
        bot.sendMessage(chatId, "هیچ هزینه‌ای ثبت نشده.");
        return;
      }

      session.costs.forEach((cost) => {
        const msgText = `💳 پرداخت‌کننده: ${cost.payer}
📌 دلیل: ${cost.reason}
💰 مبلغ: ${Number(cost.amount).toLocaleString("fa-IR")} تومان
👥 استفاده‌کننده‌ها: ${cost.users.join("، ")}`;
        bot.sendMessage(chatId, msgText);
      });
      return;
    }

    // ثبت هزینه جدید
    const parts = text.split("-");
    if (parts.length < 4)
      return bot.sendMessage(
        chatId,
        "فرمت نادرسته. فرمت صحیح:\nنام پرداخت‌کننده - دلیل - مبلغ - استفاده‌کننده‌ها"
      );

    const [payer, reason, amountText, ...users] = parts;
    const amount = parseInt(toEnDigits(amountText));
    if (!session.names.includes(payer))
      return bot.sendMessage(
        chatId,
        `نام پرداخت‌کننده '${payer}' توی لیست نیست.`
      );
    if (users.some((u) => !session.names.includes(u)))
      return bot.sendMessage(
        chatId,
        `یه یا چند نفر از استفاده‌کننده‌ها توی لیست نیستن.`
      );
    if (isNaN(amount))
      return bot.sendMessage(chatId, `مقدار پرداختی معتبر نیست.`);

    session.costs.push({
      payer,
      reason,
      amount,
      users,
    });

    bot.sendMessage(
      chatId,
      `✅ هزینه ثبت شد:
💳 پرداخت‌کننده: ${payer}
📌 دلیل: ${reason}
💰 مبلغ: ${Number(amount).toLocaleString("fa-IR")} تومان
👥 استفاده‌کننده‌ها: ${users.join("، ")}`
    );
    return;
  }

  if (session.step === "done") {
    if (text === "نمایش همه هزینه‌ها") {
      if (!session.costs || session.costs.length === 0) {
        bot.sendMessage(chatId, "هیچ هزینه‌ای ثبت نشده.");
        return;
      }

      session.costs.forEach((cost) => {
        const msgText = `💳 پرداخت‌کننده: ${cost.payer}
📌 دلیل: ${cost.reason}
💰 مبلغ: ${Number(cost.amount).toLocaleString("fa-IR")} تومان
👥 استفاده‌کننده‌ها: ${cost.users.join("، ")}`;
        bot.sendMessage(chatId, msgText);
      });
      return;
    }

    bot.sendMessage(chatId, "اگر می‌خوای دوباره شروع کنی /start بزن.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Bot is running on port", port);
});
