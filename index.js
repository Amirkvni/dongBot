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

// ذخیره اطلاعات هر چت اینجا
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
  if (!chats[chatId]) return; // اگر start نزده بودن کاری نکن

  const text = msg.text;

  switch (chats[chatId].step) {
    case "welcome":
      // گرفتن تعداد نفرات
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
        `تعداد ${count} نفر هستن، لطفاً اسم نفر اول رو وارد کن.`
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
        chats[chatId].step = "get_mom_payer";
        bot.sendMessage(chatId, `اسم افراد: ${chats[chatId].names.join(", ")}`);
        bot.sendMessage(
          chatId,
          "حالا بگو کی مادرخرج بوده؟ (اسم یکی از افراد رو وارد کن)"
        );
      }
      break;

    case "get_mom_payer":
      if (!chats[chatId].names.includes(text)) {
        bot.sendMessage(
          chatId,
          "اسم وارد شده جزو افراد نیست، لطفاً از لیست بالا یکی رو انتخاب کن."
        );
        return;
      }
      chats[chatId].mom = text;
      chats[chatId].step = "get_expenses";
      chats[chatId].expenses = [];
      bot.sendMessage(chatId, "حالا هزینه‌ها رو به ترتیب بفرست.");
      bot.sendMessage(
        chatId,
        "مثال: مقدار هزینه، دلیل هزینه، و اسم افراد سهم‌بَر (مثلاً به صورت کاما جدا)."
      );
      bot.sendMessage(chatId, `فرمت: 100000, غذا, علی، رضا، زهرا`);
      bot.sendMessage(chatId, "برای پایان دادن بنویس: پایان");
      break;

    case "get_expenses":
      if (text.trim() === "پایان") {
        // محاسبه سهم ها
        const shares = {};
        chats[chatId].names.forEach((name) => {
          shares[name] = 0;
        });

        chats[chatId].expenses.forEach((exp) => {
          const perPerson = exp.amount / exp.people.length;
          exp.people.forEach((p) => {
            if (p !== chats[chatId].mom) {
              shares[p] += perPerson;
            }
          });
        });

        let result = "سهم هر نفر که باید به مادرخرج بده:\n";
        for (const [name, share] of Object.entries(shares)) {
          if (name !== chats[chatId].mom) {
            result += `${name}: ${share.toFixed(0)} تومان\n`;
          }
        }

        bot.sendMessage(chatId, result);
        chats[chatId].step = "done";
        return;
      }

      // پارس کردن ورودی هزینه
      // فرض شده ورودی به شکل: مقدار, دلیل, اسم1، اسم2، اسم3
      const parts = text.split(",");
      if (parts.length < 3) {
        bot.sendMessage(
          chatId,
          "فرمت هزینه اشتباهه. لطفاً به شکل: مقدار, دلیل, اسم‌ها"
        );
        return;
      }
      const amount = parseFloat(parts[0].trim());
      const reason = parts[1].trim();
      const peopleText = parts.slice(2).join(",").trim();
      const people = peopleText.split(/،|,/).map((s) => s.trim());

      // بررسی افراد وارد شده
      for (const p of people) {
        if (!chats[chatId].names.includes(p)) {
          bot.sendMessage(
            chatId,
            `اسم "${p}" جزو افراد نیست، لطفاً دوباره وارد کن.`
          );
          return;
        }
      }

      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(
          chatId,
          "مقدار هزینه معتبر نیست، لطفاً دوباره وارد کن."
        );
        return;
      }

      chats[chatId].expenses.push({
        amount,
        reason,
        people,
      });

      bot.sendMessage(
        chatId,
        `هزینه ثبت شد: ${amount} تومان برای ${reason}، سهم‌بَر: ${people.join(
          ", "
        )}`
      );
      bot.sendMessage(
        chatId,
        "اگر هزینه‌های بیشتری داری بنویس، در غیر اینصورت 'پایان' رو بفرست."
      );
      break;

    case "done":
      bot.sendMessage(chatId, "اگر می‌خوای دوباره شروع کنی /start بزن.");
      break;
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
