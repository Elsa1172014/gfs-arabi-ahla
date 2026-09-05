import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function parseValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

async function loadRecords(prefix, legacyKey) {
  const keys = await redis.keys(`${prefix}*`);
  if (keys?.length) {
    const vals = await Promise.all(keys.map((k) => redis.get(k)));
    return vals.map(parseValue).filter(Boolean);
  }
  if (legacyKey) {
    const legacy = parseValue(await redis.get(legacyKey));
    if (Array.isArray(legacy)) return legacy;
  }
  return [];
}

function assignedTo(course, student) {
  if (!course || !student || course.status !== "published") return false;
  if (+course.grade !== +student.grade || String(course.stream || "A") !== String(student.stream || "A")) return false;
  if (Array.isArray(course.students) && course.students.length) return course.students.includes(student.key);
  const blocks = Array.isArray(course.blocks) ? course.blocks : [];
  return blocks.includes("ALL") || blocks.includes(student.block);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const [students, courses, attempts, progressRecords] = await Promise.all([
      loadRecords("gfs:rec:student:", "gfs:students:v5"),
      loadRecords("gfs:rec:course:", "gfs:courses:v5"),
      loadRecords("gfs:rec:attempt:", "gfs:attempts:v5"),
      loadRecords("gfs:rec:progress:", "gfs:progress:v5"),
    ]);

    const published = courses.filter((c) => c?.status === "published");
    const passedAttempts = attempts.filter((a) => a?.passed);
    const certificates = new Set(
      passedAttempts.map((a) => a.serial || `${a.student || "?"}|${a.course || "?"}`)
    ).size;

    const progressMap = {};
    for (const p of progressRecords) {
      if (!p) continue;
      const key = p.key || p.id || (p.student && p.course ? `${p.student}|${p.course}` : null);
      if (key) progressMap[key] = p;
    }

    const rows = students.map((student) => {
      const assigned = published.filter((c) => assignedTo(c, student));
      if (!assigned.length) return null;

      const studentAttempts = attempts.filter((a) => a?.student === student.key);
      const passedIds = new Set(studentAttempts.filter((a) => a.passed).map((a) => a.course));

      let completedUnits = 0;
      let totalUnits = 0;
      for (const c of assigned) {
        const total = Array.isArray(c.stages) ? c.stages.length : 0;
        totalUnits += total;
        if (passedIds.has(c.id)) {
          completedUnits += total;
          continue;
        }
        const p = progressMap[`${student.key}|${c.id}`];
        completedUnits += Math.min(total, Array.isArray(p?.done) ? p.done.length : 0);
      }

      const pct = totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0;
      return { pct };
    }).filter(Boolean);

    const advanced = rows.filter((r) => r.pct >= 90).length;
    const progressing = rows.filter((r) => r.pct >= 70 && r.pct < 90).length;
    const support = rows.filter((r) => r.pct < 70).length;
    const totalWithCourses = rows.length;
    const percent = (n) => totalWithCourses ? Math.round((n / totalWithCourses) * 100) : 0;

    const uniqueActiveStudents = new Set(
      attempts.filter((a) => {
        const t = new Date(a?.at || a?.createdAt || 0).getTime();
        return Number.isFinite(t) && Date.now() - t <= 30 * 60 * 1000;
      }).map((a) => a.student).filter(Boolean)
    ).size;

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      students: students.length,
      courses: courses.length,
      publishedCourses: published.length,
      attempts: attempts.length,
      certificates,
      activeNow: uniqueActiveStudents,
      studentsWithAssignedCourses: totalWithCourses,
      tiers: {
        advanced: { count: advanced, pct: percent(advanced) },
        progressing: { count: progressing, pct: percent(progressing) },
        support: { count: support, pct: percent(support) },
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
