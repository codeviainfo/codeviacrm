import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { clientId, status, search, dateFrom, dateTo } = req.query;
  const where: Record<string, unknown> = {};
  if (clientId && typeof clientId === "string") where.clientId = clientId;
  if (status && typeof status === "string") where.status = status;
  if ((dateFrom && typeof dateFrom === "string") || (dateTo && typeof dateTo === "string")) {
    where.date = {
      ...(typeof dateFrom === "string" ? { gte: new Date(dateFrom) } : {}),
      ...(typeof dateTo === "string" ? { lte: new Date(dateTo + "T23:59:59") } : {}),
    };
  }
  if (search && typeof search === "string") {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } },
      { client: { businessName: { contains: search, mode: "insensitive" } } },
    ];
  }
  const services = await prisma.service.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      client: {
        select: { id: true, name: true, businessName: true, email: true, phone: true, address: true, city: true },
      },
    },
  });
  res.json(services);
});

router.post("/", async (req, res) => {
  const { clientId, title, description, quantity, unitPrice, status, date } = req.body;
  if (!clientId || !title || unitPrice === undefined) {
    return res.status(400).json({ error: "clientId, title y unitPrice son obligatorios" });
  }
  const service = await prisma.service.create({
    data: {
      clientId,
      title: title.trim(),
      description: description?.trim() || null,
      quantity: Number(quantity) || 1,
      unitPrice: Number(unitPrice),
      status: status || "pending",
      date: date ? new Date(date) : new Date(),
    },
  });
  res.status(201).json(service);
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, quantity, unitPrice, status, date } = req.body;
  const service = await prisma.service.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(quantity !== undefined && { quantity: Number(quantity) }),
      ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
      ...(status !== undefined && { status }),
      ...(date !== undefined && { date: new Date(date) }),
    },
  });
  res.json(service);
});

router.delete("/:id", async (req, res) => {
  await prisma.service.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
