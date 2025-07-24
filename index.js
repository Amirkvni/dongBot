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
    editingIndex: null, // برای نگهداری شماره هزینه‌ای که میخوایم ویرایش کنیم
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

  const textRaw = msg.text.trim();
  const text = toEnDigits(textRaw);

  // اگر الان در مرحله ویرایش هزینه هستیم
  if (session.step === "editing_cost") {
    // ورودی جدید هزینه رو دریافت می‌کنیم و جایگزین می‌کنیم
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

    // جایگزینی هزینه قبلی
    if (
      session.editingIndex === null ||
      session.editingIndex < 0 ||
      session.editingIndex >= session.costs.length
    ) {
      session.step = "waiting_costs";
      session.editingIndex = null;
      return bot.sendMessage(chatId, "شماره هزینه نامعتبر است، ویرایش لغو شد.");
    }

    session.costs[session.editingIndex] = {
      payer,
      reason,
      amount,
      users,
    };

    bot.sendMessage(
      chatId,
      `✅ هزینه شماره ${
        session.editingIndex + 1
      } ویرایش شد:\n💳 پرداخت‌کننده: ${payer}\n📌 دلیل: ${reason}\n💰 مبلغ: ${amount.toLocaleString()} تومان\n👥 استفاده‌کننده‌ها: ${users.join(
        "، "
      )}`
    );

    // برگشت به مرحله دریافت هزینه‌ها
    session.step = "waiting_costs";
    session.editingIndex = null;
    return;
  }

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

      // دکمه‌ها: نمایش همه هزینه‌ها + ویرایش هزینه
      bot.sendMessage(chatId, "نتایج محاسبه شد:", {
        reply_markup: {
          keyboard: [["📋 نمایش همه هزینه‌ها", "✏️ ویرایش هزینه"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });

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

    bot.sendMessage(
      chatId,
      `✅ ثبت شد:\n💳 پرداخت‌کننده: ${payer}\n📌 دلیل: ${reason}\n💰 مبلغ: ${amount.toLocaleString()} تومان\n👥 استفاده‌کننده‌ها: ${users.join(
        "، "
      )}`
    );
    return;
  }

  // اگر مرحله پایان هست و دکمه‌ها زده شد
  if (session.step === "done") {
    if (textRaw === "📋 نمایش همه هزینه‌ها") {
      if (!session.costs.length) {
        return bot.sendMessage(chatId, "هنوز هزینه‌ای ثبت نشده.");
      }

      let textOut = "📋 لیست هزینه‌ها:\n\n";
      session.costs.forEach((c, i) => {
        textOut += `${i + 1}. 💳 پرداخت‌کننده: ${c.payer}\n📌 دلیل: ${
          c.reason
        }\n💰 مبلغ: ${c.amount.toLocaleString()} تومان\n👥 استفاده‌کننده‌ها: ${c.users.join(
          "، "
        )}\n\n`;
      });

      bot.sendMessage(chatId, textOut.trim());
      return;
    }

    if (textRaw === "✏️ ویرایش هزینه") {
      if (!session.costs.length) {
        return bot.sendMessage(chatId, "هیچ هزینه‌ای برای ویرایش ثبت نشده.");
      }
      session.step = "waiting_edit_index";
      bot.sendMessage(
        chatId,
        "شماره هزینه‌ای که می‌خوای ویرایش کنی رو وارد کن:"
      );
      return;
    }
  }

  // مرحله گرفتن شماره هزینه برای ویرایش
  if (session.step === "waiting_edit_index") {
    const idx = parseInt(text) - 1;
    if (isNaN(idx) || idx < 0 || idx >= session.costs.length) {
      return bot.sendMessage(chatId, "شماره نامعتبره، دوباره وارد کن:");
    }

    session.editingIndex = idx;
    session.step = "editing_cost";

    bot.sendMessage(
      chatId,
      `حالا هزینه جدید رو با فرمت زیر وارد کن:\nنام پرداخت‌کننده - دلیل - مقدار پرداختی - استفاده‌کننده‌ها\nمثال:\nشایان-شام-10000-امیر-کسرا-شایان-شاهین`
    );
  }
});

// محاسبه پرداخت‌ها و بدهکاری‌ها
function calcAndSend(chatId, session) {
  const debtMap = {};
  const paidTotal = {};
  const usedTotal = {};

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

  if (final.trim() === "💰 نتیجه محاسبات:") {
    final += "هیچ پرداختی لازم نیست 😊\n";
  }

  // گزارش کلی
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

    final += `▪️ ${name}: پرداختی ${paid.toFixed(0)} - سهم ${used.toFixed(
      0
    )} → ${status}\n`;
  });

  bot.sendMessage(chatId, final);
}

// اجرا
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Bot is running on port", port);
});
