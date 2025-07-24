const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const app = express();

const token = "8344521445:AAEQOldx12LoMOji6YfC91omb058bN5t-MY";
const bot = new TelegramBot(token);
const url = "https://dongbot-1.onrender.com";
bot.setWebHook(`${url}/bot${token}`);

app.use(express.json());
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const chats = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  chats[chatId] = {
    step: "welcome",
  };
  bot.sendMessage(chatId, "سلام به ربات دنگ‌باز خوش اومدی! 😊");
  bot.sendMessage(chatId, "لطفاً تعداد افراد گروه رو وارد کن (مثلاً: 4)");
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!chats[chatId] || text.startsWith("/")) return;

  const state = chats[chatId];

  switch (state.step) {
    case "welcome":
      const count = parseInt(text);
      if (isNaN(count) || count <= 0) {
        bot.sendMessage(chatId, "تعداد معتبر نیست. لطفاً فقط عدد وارد کن.");
        return;
      }
      state.count = count;
      state.names = [];
      state.step = "get_names";
      bot.sendMessage(chatId, `تعداد ${count} نفر. اسم نفر اول؟`);
      break;

    case "get_names":
      state.names.push(text.trim());
      if (state.names.length < state.count) {
        bot.sendMessage(
          chatId,
          `اسم نفر بعدی؟ (${state.names.length + 1} از ${state.count})`
        );
      } else {
        state.step = "get_expenses";
        state.expenses = [];
        bot.sendMessage(chatId, `✅ افراد: ${state.names.join("، ")}`);
        bot.sendMessage(chatId, "الان هزینه‌ها رو با فرمت زیر وارد کن:");
        bot.sendMessage(
          chatId,
          `نام پرداخت‌کننده - دلیل - مقدار پرداختی - استفاده‌کننده‌ها\nمثال:\nشایان-شام-10000-امیر-کسرا-شایان-شاهین\n\nبرای پایان وارد کردن هزینه‌ها بنویس: پایان`
        );
      }
      break;

    case "get_expenses":
      if (text.trim() === "پایان") {
        const shares = {};
        const paid = {};

        state.names.forEach((name) => {
          shares[name] = 0;
          paid[name] = 0;
        });

        state.expenses.forEach((exp) => {
          const perPerson = exp.amount / exp.users.length;
          exp.users.forEach((user) => {
            shares[user] += perPerson;
          });
          paid[exp.payer] += exp.amount;
        });

        let result = "📊 نتیجه نهایی:\n";
        state.names.forEach((name) => {
          const diff = shares[name] - paid[name];
          if (diff > 0) {
            result += `💸 ${name} باید ${diff.toFixed(0)} تومان پرداخت کنه.\n`;
          } else if (diff < 0) {
            result += `💰 ${name} باید ${Math.abs(diff).toFixed(
              0
            )} تومان دریافت کنه.\n`;
          } else {
            result += `✅ ${name} تسویه کرده.\n`;
          }
        });

        bot.sendMessage(chatId, result);
        state.step = "done";
        return;
      }

      const parts = text.split("-");
      if (parts.length < 4) {
        bot.sendMessage(
          chatId,
          "❌ فرمت اشتباهه. لطفاً طبق نمونه بنویس:\nمثال:\nشایان-شام-10000-امیر-کسرا-شایان-شاهین"
        );
        return;
      }

      const payer = parts[0].trim();
      const reason = parts[1].trim();
      const amount = parseInt(parts[2].trim());
      const users = parts.slice(3).map((u) => u.trim());

      // اعتبارسنجی
      if (!state.names.includes(payer)) {
        bot.sendMessage(
          chatId,
          `❌ پرداخت‌کننده "${payer}" در لیست افراد نیست.`
        );
        return;
      }

      const invalidUsers = users.filter((u) => !state.names.includes(u));
      if (invalidUsers.length > 0) {
        bot.sendMessage(
          chatId,
          `❌ این افراد در لیست نیستن: ${invalidUsers.join(", ")}`
        );
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, "❌ مبلغ پرداختی معتبر نیست.");
        return;
      }

      state.expenses.push({ payer, reason, amount, users });
      bot.sendMessage(
        chatId,
        `✅ هزینه ثبت شد:\n💳 پرداخت‌کننده: ${payer}\n📌 دلیل: ${reason}\n💰 مبلغ: ${amount}\n👥 استفاده‌کننده‌ها: ${users.join(
          "، "
        )}`
      );
      bot.sendMessage(
        chatId,
        "اگه هزینه دیگه‌ای هست وارد کن، اگه تموم شد بنویس: پایان"
      );
      break;

    case "done":
      bot.sendMessage(chatId, "برای شروع دوباره /start رو بزن.");
      break;
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
