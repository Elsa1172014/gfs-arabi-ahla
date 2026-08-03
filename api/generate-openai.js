// وسيط بين المتصفح و OpenAI API — المفتاح يبقى على الخادم فقط.
// أضِف OPENAI_API_KEY من لوحة Vercel (احصل عليه من platform.openai.com).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY غير مضبوط في متغيرات البيئة على Vercel" });
  }
  try {
    const { prompt, imageBase64, imageMediaType } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "missing prompt" });

    const content = [{ type: "text", text: prompt }];
    if (imageBase64) content.unshift({ type: "image_url", image_url: { url: `data:${imageMediaType || "image/jpeg"};base64,${imageBase64}` } });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error || data });
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
