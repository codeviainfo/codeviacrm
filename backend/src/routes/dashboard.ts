import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (_req, res) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalClients,
    totalLeads,
    totalProspects,
    totalArchived,
    leadsThisWeek,
    upcomingAppointments,
    recentLeads,
    statusCounts,
    categoryCounts,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "client" } }),
    prisma.client.count({ where: { status: "lead" } }),
    prisma.client.count({ where: { status: "prospect" } }),
    prisma.client.count({ where: { status: "archived" } }),
    prisma.client.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: now }, status: { in: ["pending", "confirmed"] } },
      include: { client: { select: { id: true, name: true, businessName: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { source: "google_maps" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.client.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.client.groupBy({
      by: ["category"],
      where: { category: { not: null } },
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
      take: 5,
    }),
  ]);

  const total = totalClients + totalLeads + totalProspects;
  const conversionRate = total > 0 ? Math.round((totalClients / total) * 100) : 0;

  const statusFunnel = statusCounts.map((s) => ({
    status: s.status,
    count: s._count.status,
  }));

  const topCategories = categoryCounts
    .filter((c) => c.category)
    .map((c) => ({ category: c.category as string, count: c._count.category }));

  res.json({
    totalClients,
    totalLeads,
    totalProspects,
    totalArchived,
    conversionRate,
    leadsThisWeek,
    upcomingAppointments,
    recentLeads,
    statusFunnel,
    topCategories,
  });
});

export default router;
