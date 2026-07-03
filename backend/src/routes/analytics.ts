import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const days = Math.min(Math.max(parseInt(String(req.query.days), 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    sessions,
    pageviews,
    formStartSessions,
    formSubmitSessions,
    countries,
    referrers,
    utmSources,
    devices,
    topEvents,
    sessionsByDay,
    pageviewsByDay,
  ] = await Promise.all([
    prisma.webSession.count({ where: { startedAt: { gte: since } } }),
    prisma.webEvent.count({ where: { type: "pageview", createdAt: { gte: since } } }),
    prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`SELECT COUNT(DISTINCT "sessionId")::int AS count FROM "WebEvent" WHERE "type" = 'form_start' AND "createdAt" >= ${since}`
    ),
    prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`SELECT COUNT(DISTINCT "sessionId")::int AS count FROM "WebEvent" WHERE "type" = 'form_submit' AND "createdAt" >= ${since}`
    ),
    prisma.webSession.groupBy({
      by: ["country"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 12,
    }),
    prisma.webSession.groupBy({
      by: ["referrer"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 10,
    }),
    prisma.webSession.groupBy({
      by: ["utmSource"],
      where: { startedAt: { gte: since }, utmSource: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { utmSource: "desc" } },
      take: 10,
    }),
    prisma.webSession.groupBy({
      by: ["device"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.webEvent.groupBy({
      by: ["type", "name"],
      where: { createdAt: { gte: since }, type: { not: "pageview" } },
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
      take: 12,
    }),
    prisma.$queryRaw<Array<{ date: string; count: number }>>(
      Prisma.sql`SELECT to_char(date_trunc('day', "startedAt"), 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "WebSession" WHERE "startedAt" >= ${since} GROUP BY 1 ORDER BY 1`
    ),
    prisma.$queryRaw<Array<{ date: string; count: number }>>(
      Prisma.sql`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "WebEvent" WHERE "type" = 'pageview' AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`
    ),
  ]);

  const formStarts = formStartSessions[0]?.count ?? 0;
  const formSubmits = formSubmitSessions[0]?.count ?? 0;

  // Serie continua día a día (rellena con ceros los días sin tráfico).
  const pageviewsMap = new Map(pageviewsByDay.map((r) => [r.date, r.count]));
  const sessionsMap = new Map(sessionsByDay.map((r) => [r.date, r.count]));
  const visitsByDay: Array<{ date: string; sessions: number; pageviews: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    visitsByDay.push({
      date,
      sessions: sessionsMap.get(date) ?? 0,
      pageviews: pageviewsMap.get(date) ?? 0,
    });
  }

  res.json({
    totals: {
      sessions,
      pageviews,
      formSubmits,
      conversionRate: sessions > 0 ? Math.round((formSubmits / sessions) * 1000) / 10 : 0,
    },
    visitsByDay,
    countries: countries.map((c) => ({ country: c.country, sessions: c._count._all })),
    referrers: referrers.map((r) => ({ referrer: r.referrer, sessions: r._count._all })),
    utmSources: utmSources.map((u) => ({ source: u.utmSource as string, sessions: u._count._all })),
    devices: devices.map((d) => ({ device: d.device, sessions: d._count._all })),
    funnel: { sessions, formStarts, formSubmits },
    topEvents: topEvents.map((e) => ({ type: e.type, name: e.name, count: e._count._all })),
  });
});

export default router;
