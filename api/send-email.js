// وسيط إرسال بريد حقيقي عبر Resend — المفتاح يبقى على الخادم فقط.
// أضِف RESEND_API_KEY من لوحة Vercel (احصل عليه من resend.com، مجاني للبدء).
// أضِف أيضًا RESEND_FROM بصيغة "الاسم <no-reply@نطاقك.com>" بعد توثيق نطاقك في Resend.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY غير مضبوط في متغيرات البيئة على Vercel" });
  }
  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) return res.status(400).json({ error: "missing to/subject/html" });
    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    if (!recipients.length) return res.status(400).json({ error: "no valid recipients" });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "GFS بالعربي أحلى <onboarding@resend.dev>",
        to: recipients,
        subject,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
