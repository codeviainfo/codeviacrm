import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const appointmentSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().or(z.string().min(1)),
  durationMinutes: z.number().int().positive().optional(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
});

router.get("/", async (req, res) => {
  const { clientId, status, from, to } = req.query as Record<string, string | undefined>;

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { client: { select: { id: true, name: true, businessName: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  res.json(appointments);
});

router.post("/", async (req, res) => {
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { scheduledAt, ...rest } = parsed.data;
  const appointment = await prisma.appointment.create({
    data: { ...rest, scheduledAt: new Date(scheduledAt) },
  });
  res.status(201).json(appointment);
});

router.put("/:id", async (req, res) => {
  const parsed = appointmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { scheduledAt, ...rest } = parsed.data;
  try {
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { ...rest, ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}) },
    });
    res.json(appointment);
  } catch {
    res.status(404).json({ error: "Cita no encontrada" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Cita no encontrada" });
  }
});

export default router;
