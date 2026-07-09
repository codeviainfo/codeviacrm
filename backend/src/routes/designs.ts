import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getConnectionStatus } from "../services/canvaAuthService";
import {
  getBrandTemplateDataset,
  createAutofillJob,
  getAutofillJob,
  uploadAssetFromUrl,
  createExportJob,
  pollExportJob,
  AutofillFieldValue,
} from "../services/canvaDesignService";

const router = Router();
router.use(requireAuth);

const templateSchema = z.object({
  canvaTemplateId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["flyer", "social_post", "banner"]),
  thumbnailUrl: z.string().url().optional(),
});

const updateTemplateSchema = z.object({ active: z.boolean() });

const fieldValueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image"), url: z.string().url() }),
]);

const createDesignSchema = z.object({
  brandTemplateId: z.string().min(1),
  title: z.string().optional(),
  fields: z.record(fieldValueSchema),
});

const exportSchema = z.object({ format: z.enum(["png", "pdf", "jpg"]) });

const DESIGN_INCLUDE = {
  brandTemplate: { select: { id: true, name: true, category: true } },
} as const;

// "Poll en la lectura": si el diseño sigue pending, consulta el job de
// autofill en Canva y actualiza la fila si ya resolvió. No hay
// infraestructura de colas en este backend, así que esto sustituye a un
// worker en segundo plano — el frontend ya vuelve a pedir la lista/el
// diseño cada pocos segundos mientras algo esté pending.
async function resolvePendingDesign(design: any) {
  if (design.status !== "pending") return design;

  try {
    const job = await getAutofillJob(design.canvaJobId);
    if (job.status === "success" && job.design) {
      return prisma.design.update({
        where: { id: design.id },
        data: {
          status: "success",
          canvaDesignId: job.design.id,
          editUrl: job.design.editUrl,
          thumbnailUrl: job.design.thumbnailUrl,
        },
        include: DESIGN_INCLUDE,
      });
    }
    if (job.status === "failed") {
      return prisma.design.update({
        where: { id: design.id },
        data: { status: "failed", errorMessage: job.error?.message ?? "Error desconocido de Canva" },
        include: DESIGN_INCLUDE,
      });
    }
  } catch {
    // No se pudo consultar el job todavía (p.ej. Canva desconectado); se
    // deja el diseño en pending y se reintenta en la próxima lectura.
  }
  return design;
}

/* ------------------------------------------------------------- Conexión */

router.get("/status", async (_req, res) => {
  res.json(await getConnectionStatus());
});

/* ------------------------------------------------------- Plantillas ---- */

router.get("/templates", async (req, res) => {
  const { category } = req.query;
  const where: Prisma.BrandTemplateWhereInput = { active: true };
  if (category === "flyer" || category === "social_post" || category === "banner") {
    where.category = category;
  }
  const templates = await prisma.brandTemplate.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(templates);
});

// Registra una plantilla de marca creada previamente en Canva: cachea su
// esquema de campos rellenables (dataset API) para no llamar a Canva en
// cada carga de página del formulario de generación.
router.post("/templates", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { canvaTemplateId, name, category, thumbnailUrl } = parsed.data;

  let fieldSchema;
  try {
    fieldSchema = await getBrandTemplateDataset(canvaTemplateId);
  } catch (err: any) {
    return res.status(400).json({ error: `No se pudo leer la plantilla en Canva: ${err.message}` });
  }

  try {
    const template = await prisma.brandTemplate.create({
      data: { canvaTemplateId, name, category, thumbnailUrl, fieldSchema },
    });
    res.status(201).json(template);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Esta plantilla ya está registrada" });
    }
    throw err;
  }
});

// Solo desactiva — no hay DELETE duro: los Design existentes referencian la
// plantilla con onDelete Cascade y borrarla se llevaría el historial.
router.patch("/templates/:id", async (req, res) => {
  const parsed = updateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const template = await prisma.brandTemplate.update({
      where: { id: req.params.id },
      data: { active: parsed.data.active },
    });
    res.json(template);
  } catch {
    res.status(404).json({ error: "Plantilla no encontrada" });
  }
});

/* ---------------------------------------------------------- Generación */

// Descarga+sube cualquier campo de imagen a Canva, crea el job de autofill
// y responde de inmediato con status=pending — no espera a que el job
// resuelva (puede tardar varios segundos); el frontend hace polling vía
// GET /:id.
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createDesignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { brandTemplateId, title, fields } = parsed.data;

  const template = await prisma.brandTemplate.findUnique({ where: { id: brandTemplateId } });
  if (!template || !template.active) {
    return res.status(404).json({ error: "Plantilla no encontrada" });
  }

  try {
    const data: Record<string, AutofillFieldValue> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value.type === "text") {
        data[key] = { type: "text", text: value.text };
      } else {
        const assetId = await uploadAssetFromUrl(value.url, `${brandTemplateId}-${key}`);
        data[key] = { type: "image", asset_id: assetId };
      }
    }

    const canvaJobId = await createAutofillJob(template.canvaTemplateId, title, data);

    const design = await prisma.design.create({
      data: {
        brandTemplateId,
        title,
        status: "pending",
        canvaJobId,
        createdByUserId: req.userId,
      },
      include: DESIGN_INCLUDE,
    });

    res.status(201).json(design);
  } catch (err: any) {
    res.status(502).json({ error: "No se pudo generar el diseño", details: err.message });
  }
});

router.get("/", async (req, res) => {
  const { status, category } = req.query;
  const where: Prisma.DesignWhereInput = {};
  if (status === "pending" || status === "success" || status === "failed") {
    where.status = status;
  }
  if (category === "flyer" || category === "social_post" || category === "banner") {
    where.brandTemplate = { category };
  }

  const designs = await prisma.design.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: DESIGN_INCLUDE,
  });

  const resolved = await Promise.all(designs.map((d) => resolvePendingDesign(d)));
  res.json(resolved);
});

router.get("/:id", async (req, res) => {
  const design = await prisma.design.findUnique({
    where: { id: req.params.id },
    include: DESIGN_INCLUDE,
  });
  if (!design) return res.status(404).json({ error: "Diseño no encontrado" });
  res.json(await resolvePendingDesign(design));
});

// Acción explícita del usuario ("Exportar") — aquí sí se hace un sondeo
// síncrono acotado (ver pollExportJob) porque una espera de varios
// segundos es UX esperada en este punto.
router.post("/:id/export", async (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const design = await prisma.design.findUnique({ where: { id: req.params.id } });
  if (!design) return res.status(404).json({ error: "Diseño no encontrado" });
  if (design.status !== "success" || !design.canvaDesignId) {
    return res.status(400).json({ error: "El diseño todavía no está listo para exportar" });
  }

  try {
    const jobId = await createExportJob(design.canvaDesignId, parsed.data.format);
    const job = await pollExportJob(jobId);
    if (job.status !== "success" || !job.urls?.length) {
      return res.status(502).json({ error: "La exportación no terminó a tiempo, inténtalo de nuevo" });
    }
    const updated = await prisma.design.update({
      where: { id: design.id },
      data: { exportedFileUrl: job.urls[0], exportFormat: parsed.data.format },
      include: DESIGN_INCLUDE,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
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
