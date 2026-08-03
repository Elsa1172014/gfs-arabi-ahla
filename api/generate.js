// وسيط بين المتصفح و Anthropic API — المفتاح السرّي يبقى على الخادم فقط.
// أضِف ANTHROPIC_API_KEY من لوحة Vercel: Settings → Environment Variables.
// يعيد دائمًا الشكل الموحَّد { text } بصرف النظر عن مزوّد النموذج، ليتعامل
// الواجهة الأمامية مع الردود الثلاثة (Claude/Gemini/ChatGPT) بمنطق واحد.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY غير مضبوط في متغيرات البيئة على Vercel" });
  }
  try {
    const { prompt, imageBase64, imageMediaType } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "missing prompt" });

    const content = [];
    if (imageBase64) {
      content.push({ type: "image", source: { type: "base64", media_type: imageMediaType || "image/jpeg", data: imageBase64 } });
    }
    content.push({ type: "text", text: prompt });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error || data });
    const text = (data.content || []).map((c) => c.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
