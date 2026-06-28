import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { clientId } = req.query;
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "clientId requerido" });
  }
  const services = await prisma.service.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
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
