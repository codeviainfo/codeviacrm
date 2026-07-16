import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  isClaudeConfigured,
  generateDesignHtml,
  DESIGN_DIMENSIONS,
} from "../services/claudeDesignService";
import { renderHtmlToPng } from "../services/designRenderService";

const router = Router();

const createDesignSchema = z.object({
  category: z.enum(["flyer", "social_post", "banner"]),
  title: z.string().optional(),
  brief: z.string().min(1, "Describe qué quieres generar"),
  referenceImageUrl: z.string().url().optional(),
});

// Campos listados en historial/detalle — nunca incluye `imageData` (el PNG
// completo), que solo viaja por GET /:id/image.
const DESIGN_LIST_SELECT = {
  id: true,
  category: true,
  title: true,
  brief: true,
  referenceImageUrl: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;

// SIN requireAuth y declarada antes de router.use(requireAuth): un <img src>
// no puede llevar cabecera Authorization, así que esta ruta se apoya en que
// el id es un UUID no adivinable — mismo patrón que /api/track (público).
router.get("/:id/image", async (req, res) => {
  const design = await prisma.design.findUnique({
    where: { id: req.params.id },
    select: { imageData: true, imageMime: true },
  });
  if (!design || !design.imageData) return res.status(404).end();
  res.set("Content-Type", design.imageMime || "image/png");
  res.send(design.imageData);
});

router.use(requireAuth);

// Genera la pieza de principio a fin de forma síncrona (llamada a Claude +
// render con Playwright, unos segundos): no hay infraestructura de colas en
// este backend y el volumen esperado de este módulo es bajo, así que una
// espera de varios segundos en el botón "Generar" es UX aceptable.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createDesignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!isClaudeConfigured()) {
    return res.status(400).json({ error: "Falta configurar ANTHROPIC_API_KEY" });
  }

  const { category, title, brief, referenceImageUrl } = parsed.data;
  const { width, height } = DESIGN_DIMENSIONS[category];

  const design = await prisma.design.create({
    data: { category, title, brief, referenceImageUrl, status: "pending", createdByUserId: req.userId },
    select: DESIGN_LIST_SELECT,
  });

  try {
    const html = await generateDesignHtml({ category, brief, title, referenceImageUrl });
    const png = await renderHtmlToPng(html, width, height);
    const updated = await prisma.design.update({
      where: { id: design.id },
      data: { status: "success", imageData: png, imageMime: "image/png" },
      select: DESIGN_LIST_SELECT,
    });
    res.status(201).json(updated);
  } catch (err: any) {
    const updated = await prisma.design.update({
      where: { id: design.id },
      data: { status: "failed", errorMessage: err.message || "Error desconocido al generar el diseño" },
      select: DESIGN_LIST_SELECT,
    });
    res.status(502).json(updated);
  }
});

router.get("/", async (req, res) => {
  const { status, category } = req.query;
  const where: Prisma.DesignWhereInput = {};
  if (status === "pending" || status === "success" || status === "failed") {
    where.status = status;
  }
  if (category === "flyer" || category === "social_post" || category === "banner") {
    where.category = category;
  }

  const designs = await prisma.design.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: DESIGN_LIST_SELECT,
  });
  res.json(designs);
});

router.get("/:id", async (req, res) => {
  const design = await prisma.design.findUnique({
    where: { id: req.params.id },
    select: DESIGN_LIST_SELECT,
  });
  if (!design) return res.status(404).json({ error: "Diseño no encontrado" });
  res.json(design);
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.design.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Diseño no encontrado" });
  }
});

export default router;
