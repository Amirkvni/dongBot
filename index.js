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

// ==== ربات اصلی ====
const sessions = new Map();

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
  if (!session || msg.text.startsWith("/start")) return;

  const text = toEnDigits(msg.text.trim());

  // مرحله گرفتن تعداد نفرات
  if (session.step === "waiting_count") {
    const count = parseInt(text);
    if (isNaN(count) || count < 1)
      return bot.sendMessage(chatId, "تعداد نامعتبره. یه عدد بفرست");

    session.totalCount = count;
    session.step = "waiting_names";
    session.names = [];
    bot.sendMessage(chatId, `اسم نفر اول رو وارد کن:`);
    return;
  }

  // مرحله گرفتن اسامی
  if (session.step === "waiting_names") {
    if (session.names.includes(text))
      return bot.sendMessage(chatId, "اسم تکراریه، یه اسم دیگه وارد کن");

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
    }
    return;
  }

  // مرحله گرفتن هزینه‌ها
  if (session.step === "waiting_costs") {
    if (text === "پایان") {
      session.step = "done";
      return calcAndSend(chatId, session);
    }

    const parts = text.split("-");
    if (parts.length < 4)
      return bot.sendMessage(chatId, "فرمت نادرسته. با الگو مطابقت نداره.");

    const [payer, reason, amountText, ...users] = parts;
    const amount = parseInt(toEnDigits(amountText));
    if (!session.names.includes(payer))
      return bot.sendMessage(
        chatId,
        `نام پرداخت‌کننده '${payer}' توی لیست نیست`
      );
    if (users.some((u) => !session.names.includes(u)))
      return bot.sendMessage(
        chatId,
        `یه یا چند نفر از استفاده‌کننده‌ها توی لیست نیستن`
      );
    if (isNaN(amount))
      return bot.sendMessage(chatId, `مقدار پرداختی معتبر نیست`);

    session.costs.push({
      payer,
      reason,
      amount,
      users,
    });

    bot.sendMessage(chatId, `✅ ثبت شد. هزینه‌ی "${reason}" توسط ${payer}`);
    return;
  }
});

// محاسبه پرداخت‌ها و بدهکاری‌ها
function calcAndSend(chatId, session) {
  const debtMap = {}; // {from: {to: amount}}
  const paidTotal = {}; // {name: total_paid}
  const usedTotal = {}; // {name: total_used}

  session.names.forEach((name) => {
    debtMap[name] = {};
    paidTotal[name] = 0;
    usedTotal[name] = 0;
    session.names.forEach((other) => {
      if (other !== name) debtMap[name][other] = 0;
    });
  });

  for (const cost of session.costs) {
    const share = cost.amount / cost.users.length;
    paidTotal[cost.payer] += cost.amount;
    for (const u of cost.users) {
      usedTotal[u] += share;
      if (u !== cost.payer) {
        debtMap[u][cost.payer] += share;
      }
    }
  }

  let final = `💰 نتیجه محاسبات:\n\n`;
  session.names.forEach((from) => {
    session.names.forEach((to) => {
      if (from !== to) {
        const pay = debtMap[from][to] - debtMap[to][from];
        if (pay > 0) {
          final += `🔸 ${from} باید ${pay.toFixed(0)} تومان به ${to} بدهد\n`;
        }
      }
    });
  });

  // اگر هیچ بدهی نداشتن
  if (final.trim() === "💰 نتیجه محاسبات:") {
    final += "هیچ پرداختی لازم نیست 😊\n";
  }

  // اضافه کردن گزارش پرداختی‌ها و بدهکاری‌ها
  final += `\n📊 گزارش پرداختی‌ها و بدهکاری‌ها:\n`;
  session.names.forEach((name) => {
    const paid = paidTotal[name];
    const used = usedTotal[name];
    const diff = paid - used;

    const status =
      diff > 0
        ? `طلبکار ${diff.toFixed(0)} تومان`
        : diff < 0
        ? `بدهکار ${(diff * -1).toFixed(0)} تومان`
        : "تسویه شده ✅";

    final += `▪️ ${name}: پرداختی ${paid.toFixed(0)} تومان - سهم ${used.toFixed(
      0
    )} تومان → ${status}\n`;
  });

  bot.sendMessage(chatId, final);
}

// اجرا
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Bot is running on port", port);
});
