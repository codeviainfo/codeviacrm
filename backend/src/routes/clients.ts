import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const clientSchema = z.object({
  name: z.string().min(1),
  businessName: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["lead", "prospect", "client", "inactive", "archived"]).optional(),
  website: z.string().optional().nullable(),
});

function buildWhere(q: Record<string, string | undefined>) {
  const { status, category, zone, search, city, source, hasPhone, hasWebsite, createdFrom, createdTo } = q;
  return {
    ...(status ? { status: status as any } : {}),
    ...(category ? { category: { contains: category, mode: "insensitive" as const } } : {}),
    ...(zone ? { zone: { contains: zone, mode: "insensitive" as const } } : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
    ...(source === "manual" || source === "google_maps" ? { source: source as any } : {}),
    ...(hasPhone === "true" ? { NOT: { phone: null } } : hasPhone === "false" ? { phone: null } : {}),
    ...(hasWebsite === "true" ? { NOT: { website: null } } : hasWebsite === "false" ? { website: null } : {}),
    ...(createdFrom || createdTo
      ? {
          createdAt: {
            ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
            ...(createdTo ? { lte: new Date(createdTo + "T23:59:59") } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { businessName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get("/", async (req, res) => {
  const clients = await prisma.client.findMany({
    where: buildWhere(req.query as Record<string, string | undefined>),
    orderBy: { createdAt: "desc" },
  });
  res.json(clients);
});

// GET /clients/export — download filtered clients as CSV.
// Must be declared before /:id so Express doesn't treat "export" as an id param.
router.get("/export", async (req, res) => {
  const clients = await prisma.client.findMany({
    where: buildWhere(req.query as Record<string, string | undefined>),
    orderBy: { createdAt: "desc" },
  });

  const header = ["Nombre", "Negocio", "Categoría", "Teléfono", "Email", "Dirección", "Ciudad", "Zona", "Estado", "Fuente", "Web", "Valoración", "Creado"];
  const rows = clients.map((c) => [
    c.name,
    c.businessName,
    c.category,
    c.phone,
    c.email,
    c.address,
    c.city,
    c.zone,
    c.status,
    c.source,
    c.website,
    c.rating,
    c.createdAt.toLocaleDateString("es-ES"),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="clientes.csv"');
  res.send("﻿" + csv); // BOM for Excel UTF-8 compatibility
});

router.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { appointments: { orderBy: { scheduledAt: "desc" } } },
  });
  if (!client) return res.status(404).json({ error: "Cliente no encontrado" });
  res.json(client);
});

router.post("/", async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const client = await prisma.client.create({
    data: { ...parsed.data, source: "manual" },
  });
  res.status(201).json(client);
});

router.put("/:id", async (req, res) => {
  const parsed = clientSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(client);
  } catch {
    res.status(404).json({ error: "Cliente no encontrado" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Cliente no encontrado" });
  }
});

export default router;
