// وسيط بين المتصفح و Google Gemini API — المفتاح يبقى على الخادم فقط.
// أضِف GEMINI_API_KEY من لوحة Vercel (احصل عليه من aistudio.google.com).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY غير مضبوط في متغيرات البيئة على Vercel" });
  }
  try {
    const { prompt, imageBase64, imageMediaType } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "missing prompt" });

    const parts = [{ text: prompt }];
    if (imageBase64) parts.unshift({ inline_data: { mime_type: imageMediaType || "image/jpeg", data: imageBase64 } });

    const model = "gemini-2.5-flash";
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }] }),
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error || data });
    const text = ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
