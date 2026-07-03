import { Router, Request } from "express";
import express from "express";
import { z } from "zod";
import geoip from "geoip-lite";
import { prisma } from "../lib/prisma";

const router = Router();

// La landing envía los eventos como text/plain (petición CORS "simple", sin
// preflight, compatible con fetch keepalive al cerrar la pestaña), así que
// se parsea el JSON a mano en el handler.
router.use(express.text({ type: "*/*", limit: "10kb" }));

const metaSchema = z.object({
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
  language: z.string().max(20).optional(),
});

const eventSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.string().min(1).max(40),
  name: z.string().max(160).optional(),
  path: z.string().max(300).optional(),
  meta: metaSchema.optional(),
});

// Rate limit en memoria por IP: suficiente para un endpoint público de bajo
// tráfico sin añadir dependencias ni estado externo.
const RATE_LIMIT = 120; // eventos por IP por minuto
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > 10_000) rateBuckets.clear();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

const OWN_HOSTS = new Set(["codeviaesp.com", "www.codeviaesp.com", "localhost"]);

// Guarda solo el hostname del referrer; la navegación interna cuenta como
// tráfico directo (referrer vacío).
function normalizeReferrer(referrer?: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return OWN_HOSTS.has(host) ? null : host;
  } catch {
    return null;
  }
}

function clientIp(req: Request): string {
  return (req.headers["x-real-ip"] as string) || req.ip || "";
}

router.post("/", async (req, res) => {
  const ip = clientIp(req);
  if (rateLimited(ip)) return res.status(429).end();

  let payload: unknown;
  try {
    payload = JSON.parse(typeof req.body === "string" ? req.body : "");
  } catch {
    return res.status(400).json({ error: "JSON inválido" });
  }

  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return res.status(400).json({ error: "Evento inválido" });

  const { sessionId, type, name, path, meta } = parsed.data;

  try {
    // Solo se persiste el país derivado de la IP, nunca la IP.
    const country = geoip.lookup(ip)?.country ?? null;

    await prisma.webSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        country,
        referrer: normalizeReferrer(meta?.referrer),
        utmSource: meta?.utmSource ?? null,
        utmMedium: meta?.utmMedium ?? null,
        utmCampaign: meta?.utmCampaign ?? null,
        device: meta?.device ?? null,
        language: meta?.language ?? null,
      },
      update: { lastSeenAt: new Date() },
    });

    await prisma.webEvent.create({ data: { sessionId, type, name, path } });
    res.status(204).end();
  } catch (err) {
    console.error("Error registrando evento de analítica:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
