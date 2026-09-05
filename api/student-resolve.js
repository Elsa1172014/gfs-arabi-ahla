import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function normalizeName(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function prefixMatches(entered, stored) {
  const a = normalizeName(entered).split(" ").filter(Boolean);
  const b = normalizeName(stored).split(" ").filter(Boolean);
  if (a.length !== 2 && a.length !== 3) return false;
  if (b.length < a.length) return false;
  return a.every((part, i) => part === b[i]);
}

function parseValue(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return v; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const sid = String(req.body?.sid || "").replace(/\D/g, "").slice(-6);
    const enteredName = String(req.body?.name || "").trim();
    const parts = normalizeName(enteredName).split(" ").filter(Boolean);

    if (!/^\d{6}$/.test(sid)) return res.status(400).json({ ok: false, error: "invalid_id" });
    if (parts.length !== 2 && parts.length !== 3) return res.status(400).json({ ok: false, error: "invalid_name_length" });

    const candidates = [];

    // Newer record-per-student storage.
    const keys = await redis.keys(`gfs:rec:student:*-${sid}`);
    for (const key of keys || []) {
      const rec = parseValue(await redis.get(key));
      if (rec && typeof rec === "object") candidates.push(rec);
    }

    // Older combined students array used by earlier versions of the platform.
    if (!candidates.length) {
      const legacy = parseValue(await redis.get("gfs:students:v5"));
      if (Array.isArray(legacy)) {
        for (const rec of legacy) {
          const recSid = String(rec?.schoolId || rec?.key?.split("-")?.pop() || "").replace(/\D/g, "").slice(-6);
          if (recSid === sid) candidates.push(rec);
        }
      }
    }

    const matches = candidates.filter((s) => s?.name && prefixMatches(enteredName, s.name));
    if (matches.length !== 1) {
      return res.status(404).json({ ok: false, error: matches.length > 1 ? "ambiguous" : "not_found" });
    }

    return res.status(200).json({ ok: true, fullName: matches[0].name });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e) });
  }
}
