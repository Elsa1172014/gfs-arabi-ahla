// تذكير دوري للمعلمين — يعمل تلقائيًا حسب الجدولة في vercel.json (لا يحتاج
// أحدًا ليضغط زرًا). يقرأ بيانات المنصة مباشرة من Redis بنفس مفاتيح السجلّات
// التي تستعملها الواجهة (REC.course في src/App.jsx)، فلا ازدواجية في مصدر الحقيقة.
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const REMIND_AFTER_DAYS = 14; // عدّل هذا الرقم إن أردت تكرارًا أقصر أو أطول

export default async function handler(req, res) {
  // حماية: لا يُشغَّل هذا الطريق إلا عبر Vercel Cron (يرسل هذا الترويسة تلقائيًا
  // عند ضبط CRON_SECRET) أو من يعرف السرّ صراحة.
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ skipped: "RESEND_API_KEY غير مضبوط — لا بريد للإرسال" });
  }

  try {
    const courseKeys = await redis.keys("gfs:rec:course:*");
    const courseVals = courseKeys.length ? await redis.mget(...courseKeys) : [];
    const courses = courseVals
      .map((v) => { if (!v) return null; if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } } return v; })
      .filter(Boolean);
    const teachersRaw = await redis.get("gfs:teachers:v5");
    const teachers = Array.isArray(teachersRaw) ? teachersRaw : (teachersRaw ? JSON.parse(teachersRaw) : []);

    const now = Date.now();
    const cutoff = now - REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const reminded = [];

    for (const t of teachers) {
      if (!t.active || !t.email) continue;
      const mine = courses.filter((c) => c.teacher === t.name);
      const lastPublished = mine
        .map((c) => (c.publishedAt ? new Date(c.publishedAt).getTime() : 0))
        .reduce((a, b) => Math.max(a, b), 0);
      const needsReminder = mine.length === 0 || lastPublished < cutoff;
      if (!needsReminder) continue;

      const html = mine.length === 0
        ? `<p>مرحبًا ${t.name}،</p><p>لم تُنشئ بعد أي كورس على منصة «بالعربي أحلى». طلابك بانتظار أول كورس منك.</p>`
        : `<p>مرحبًا ${t.name}،</p><p>مضى أكثر من ${REMIND_AFTER_DAYS} يومًا منذ آخر كورس نشرته. فكّر في إضافة كورس جديد لطلابك.</p>`;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "GFS بالعربي أحلى <onboarding@resend.dev>",
          to: [t.email],
          subject: "تذكير: كورسات طلابك بانتظارك",
          html,
        }),
      });
      if (r.ok) reminded.push(t.name);
    }

    return res.status(200).json({ ok: true, remindedTeachers: reminded, checked: teachers.length });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
