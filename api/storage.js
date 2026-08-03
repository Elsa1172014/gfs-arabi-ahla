// تخزين حقيقي مشترك لكل زوّار المنصة، مبني على Redis (تكامل Upstash من
// متجر Vercel). فعّله من لوحة Vercel: Storage → Marketplace → Redis →
// اربطه بالمشروع، وستُضاف متغيرات البيئة اللازمة تلقائيًا.
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { action, key, prefix } = req.query;
      if (action === "list") {
        const keys = await redis.keys(`${prefix || ""}*`);
        return res.status(200).json({ keys, prefix });
      }
      if (!key) return res.status(400).json({ error: "missing key" });
      const value = await redis.get(key);
      if (value === null || value === undefined) return res.status(404).json({ error: "not found" });
      return res.status(200).json({ key, value: typeof value === "string" ? value : JSON.stringify(value) });
    }

    if (req.method === "POST") {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: "missing key" });
      await redis.set(key, value);
      return res.status(200).json({ key, value });
    }

    if (req.method === "DELETE") {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "missing key" });
      await redis.del(key);
      return res.status(200).json({ key, deleted: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
