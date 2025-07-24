const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const app = express();

const token = "توکن_ربات_تو"; // اینجا توکن خودتو بذار
const bot = new TelegramBot(token);
const url = "https://dongbot-1.onrender.com";
bot.setWebHook(`${url}/bot${token}`);

app.use(express.json());
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ذخیره اطلاعات هر چت
const chats = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  chats[chatId] = {
    step: "welcome",
  };
  bot.sendMessage(chatId, "سلام به ربات دنگ باز خوش اومدین.");
  bot.sendMessage(chatId, "لطفاً تعداد نفرات رو وارد کن.");
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!chats[chatId]) return;

  const text = msg.text;

  switch (chats[chatId].step) {
    case "welcome":
      const count = parseInt(text);
      if (isNaN(count) || count <= 0) {
        bot.sendMessage(chatId, "تعداد نفرات معتبر نیست، لطفاً عدد وارد کن.");
        return;
      }
      chats[chatId].count = count;
      chats[chatId].names = [];
      chats[chatId].step = "get_names";
      bot.sendMessage(
        chatId,
        `تعداد ${count} نفر هستن. اسم نفر اول رو وارد کن.`
      );
      break;

    case "get_names":
      chats[chatId].names.push(text);
      if (chats[chatId].names.length < chats[chatId].count) {
        bot.sendMessage(
          chatId,
          `اسم نفر بعدی رو وارد کن (${chats[chatId].names.length + 1} از ${
            chats[chatId].count
          })`
        );
      } else {
        chats[chatId].step = "get_expenses";
        chats[chatId].expenses = [];
        bot.sendMessage(chatId, `اسم افراد: ${chats[chatId].names.join(", ")}`);
        bot.sendMessage(chatId, "الان هزینه‌ها رو وارد کن.");
        bot.sendMessage(
          chatId,
          "فرمت: 100000, غذا, علی، رضا | پرداخت‌کننده: رضا"
        );
        bot.sendMessage(chatId, "برای پایان دادن بنویس: پایان");
      }
      break;

    case "get_expenses":
      if (text.trim() === "پایان") {
        // محاسبه سهم‌ها
        const shares = {};
        const paid = {};

        chats[chatId].names.forEach((name) => {
          shares[name] = 0;
          paid[name] = 0;
        });

        chats[chatId].expenses.forEach((exp) => {
          const perPerson = exp.amount / exp.users.length;

          exp.users.forEach((user) => {
            shares[user] += perPerson;
          });

          exp.payers.forEach((payer) => {
            paid[payer] += exp.amount / exp.payers.length;
          });
        });

        // محاسبه نهایی
        let result = "📊 نتیجه نهایی:\n";
        chats[chatId].names.forEach((name) => {
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
        chats[chatId].step = "done";
        return;
      }

      const [expensePart, payerPart] = text.split("|");

      if (!payerPart || !expensePart) {
        bot.sendMessage(
          chatId,
          "❌ فرمت اشتباهه. فرمت درست: 120000, دلیل, اسم‌ها | پرداخت‌کننده: اسم‌ها"
        );
        return;
      }

      const expParts = expensePart.split(",");
      if (expParts.length < 3) {
        bot.sendMessage(
          chatId,
          "❌ لطفاً مقدار، دلیل و افراد استفاده‌کننده رو مشخص کن."
        );
        return;
      }

      const amount = parseFloat(expParts[0].trim());
      const reason = expParts[1].trim();
      const people = expParts
        .slice(2)
        .join(",")
        .split(/،|,/)
        .map((p) => p.trim());

      const payerRaw = payerPart.replace(/پرداخت‌کننده:/, "").trim();
      const payers = payerRaw.split(/،|,/).map((p) => p.trim());

      // اعتبارسنجی
      for (const name of [...people, ...payers]) {
        if (!chats[chatId].names.includes(name)) {
          bot.sendMessage(chatId, `❌ اسم "${name}" توی لیست افراد نیست.`);
          return;
        }
      }

      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, "❌ مبلغ معتبر نیست.");
        return;
      }

      chats[chatId].expenses.push({ amount, reason, users: people, payers });
      bot.sendMessage(
        chatId,
        `✅ هزینه "${reason}" به مبلغ ${amount} ثبت شد.\n👥 استفاده‌کننده‌ها: ${people.join(
          "، "
        )}\n💳 پرداخت‌کننده‌ها: ${payers.join("، ")}`
      );
      bot.sendMessage(
        chatId,
        "اگه هزینه دیگه‌ای داری بفرست، اگه تموم شد بنویس: پایان"
      );
      break;

    case "done":
      bot.sendMessage(chatId, "اگه می‌خوای دوباره شروع کنی /start رو بفرست.");
      break;
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
