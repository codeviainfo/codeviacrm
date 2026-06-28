import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isGooglePlacesConfigured, searchPlacesByZoneAndCategory, ScrapedPlace } from "../services/googlePlacesService";
import { scrapeGoogleMaps } from "../services/mapsScraperService";
import { searchBusinessesInPolygon } from "../services/overpassService";

const router = Router();
router.use(requireAuth);

const scrapeSchema = z.object({
  zone: z.string().min(1),
  category: z.string().min(1),
});

const areaSchema = z.object({
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  category: z.string().min(1),
  cityLabel: z.string().optional(),
});

const idsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

// Persist scraped places as pending ScrapeCandidates for a job, de-duped within
// the run (Google/OSM sometimes repeat entries). Shared by /scrape and /scrape/area.
async function saveCandidates(
  jobId: string,
  places: ScrapedPlace[],
  zone: string,
  category: string
) {
  const candidates = [];
  const seen = new Set<string>();
  for (const place of places) {
    const key = place.googlePlaceId || `${place.name}|${place.address ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip businesses that are already in the client pipeline (any status).
    // Rejected ScrapeCandidate rows (from previous runs) are fine to re-show.
    const existingClient = place.googlePlaceId
      ? await prisma.client.findUnique({ where: { googlePlaceId: place.googlePlaceId }, select: { id: true } })
      : await prisma.client.findFirst({
          where: { name: place.name, address: place.address ?? undefined },
          select: { id: true },
        });
    if (existingClient) continue;

    const website = place.website ?? null;
    const created = await prisma.scrapeCandidate.create({
      data: {
        jobId,
        name: place.name,
        businessName: place.name,
        category: place.category ?? category,
        phone: place.phone,
        address: place.address,
        zone,
        rating: place.rating,
        website,
        hasWebsite: Boolean(website),
        latitude: place.latitude,
        longitude: place.longitude,
        googlePlaceId: place.googlePlaceId,
        googleMapsUrl: place.googleMapsUrl,
      },
    });
    candidates.push(created);
  }
  return candidates;
}

router.get("/jobs", async (_req, res) => {
  const jobs = await prisma.scrapeJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { candidates: true } } },
  });
  res.json(jobs);
});

// POST /scrape — runs a search and stores every business found as a pending
// ScrapeCandidate. Nothing becomes a Client here; the user reviews candidates
// and promotes the ones they want via /scrape/candidates/accept.
router.post("/", async (req, res) => {
  const parsed = scrapeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { zone, category } = parsed.data;

  const job = await prisma.scrapeJob.create({
    data: { zone, category, status: "running" },
  });

  let places: ScrapedPlace[] = [];
  let source = "google_places_api";

  try {
    if (isGooglePlacesConfigured()) {
      places = await searchPlacesByZoneAndCategory(zone, category);
    } else {
      throw new Error("API no configurada, usando fallback");
    }
  } catch (apiError) {
    try {
      source = "playwright_fallback";
      places = await scrapeGoogleMaps(zone, category);
    } catch (scrapeError: any) {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "failed", errorMessage: scrapeError.message, source },
      });
      return res.status(502).json({ error: "No se pudo completar la búsqueda", details: scrapeError.message });
    }
  }

  const candidates = await saveCandidates(job.id, places, zone, category);

  await prisma.scrapeJob.update({
    where: { id: job.id },
    data: { status: "completed", resultsCount: candidates.length, source },
  });

  res.status(201).json({ jobId: job.id, source, found: places.length, candidates });
});

// POST /scrape/area — capture businesses inside a polygon drawn on the map,
// using OpenStreetMap/Overpass (free, no API key). Feeds the same candidate
// review flow as /scrape.
router.post("/area", async (req, res) => {
  const parsed = areaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { polygon, category, cityLabel } = parsed.data;
  const zone = cityLabel?.trim() || "Zona dibujada";

  const job = await prisma.scrapeJob.create({
    data: { zone, category, status: "running", source: "overpass" },
  });

  let places: ScrapedPlace[] = [];
  try {
    places = await searchBusinessesInPolygon(polygon, category);
  } catch (err: any) {
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: err.message, source: "overpass" },
    });
    return res.status(502).json({ error: "No se pudo completar la búsqueda por zona", details: err.message });
  }

  const candidates = await saveCandidates(job.id, places, zone, category);

  await prisma.scrapeJob.update({
    where: { id: job.id },
    data: { status: "completed", resultsCount: candidates.length, source: "overpass" },
  });

  res.status(201).json({ jobId: job.id, source: "overpass", found: places.length, candidates });
});

function escapeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCandidateWhere(req: import("express").Request): Prisma.ScrapeCandidateWhereInput {
  const { jobId, status, hasWebsite, search } = req.query;
  const where: Prisma.ScrapeCandidateWhereInput = {};
  if (typeof jobId === "string" && jobId) where.jobId = jobId;
  if (status === "pending" || status === "accepted" || status === "rejected") where.status = status;
  if (hasWebsite === "true") where.hasWebsite = true;
  if (hasWebsite === "false") where.hasWebsite = false;
  if (typeof search === "string" && search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

// GET /scrape/candidates/export — download filtered candidates as CSV.
// Must be declared before /candidates so Express doesn't route "export" as a query match.
router.get("/candidates/export", async (req, res) => {
  const candidates = await prisma.scrapeCandidate.findMany({
    where: buildCandidateWhere(req),
    orderBy: { createdAt: "desc" },
  });

  const header = ["Nombre", "Negocio", "Categoría", "Teléfono", "Dirección", "Zona", "Web", "Tiene web", "Valoración", "Estado", "Creado"];
  const rows = candidates.map((c) => [
    c.name,
    c.businessName,
    c.category,
    c.phone,
    c.address,
    c.zone,
    c.website,
    c.hasWebsite ? "Sí" : "No",
    c.rating,
    c.status,
    c.createdAt.toLocaleDateString("es-ES"),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="candidatos.csv"');
  res.send("﻿" + csv);
});

// GET /scrape/candidates — review list with filters.
// Query: jobId, status (pending|accepted|rejected), hasWebsite (true|false), search.
router.get("/candidates", async (req, res) => {
  const candidates = await prisma.scrapeCandidate.findMany({
    where: buildCandidateWhere(req),
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json(candidates);
});

// POST /scrape/candidates/accept — promote the given pending candidates to
// Client rows with status=lead (skipping any that already exist as a Client).
router.post("/candidates/accept", async (req, res) => {
  const parsed = idsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const candidates = await prisma.scrapeCandidate.findMany({
    where: { id: { in: parsed.data.ids }, status: "pending" },
  });

  const clients = [];
  for (const cand of candidates) {
    const existing = cand.googlePlaceId
      ? await prisma.client.findUnique({ where: { googlePlaceId: cand.googlePlaceId } })
      : await prisma.client.findFirst({
          where: { name: cand.name, address: cand.address ?? undefined },
        });

    const client =
      existing ??
      (await prisma.client.create({
        data: {
          name: cand.name,
          businessName: cand.businessName,
          category: cand.category,
          phone: cand.phone,
          address: cand.address,
          zone: cand.zone,
          rating: cand.rating,
          website: cand.website,
          latitude: cand.latitude,
          longitude: cand.longitude,
          googleMapsUrl: cand.googleMapsUrl,
          googlePlaceId: cand.googlePlaceId,
          status: "lead",
          source: "google_maps",
        },
      }));

    await prisma.scrapeCandidate.update({
      where: { id: cand.id },
      data: { status: "accepted", clientId: client.id },
    });
    clients.push(client);
  }

  res.json({ accepted: clients.length, clients });
});

// POST /scrape/candidates/reject — discard the given pending candidates.
router.post("/candidates/reject", async (req, res) => {
  const parsed = idsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await prisma.scrapeCandidate.updateMany({
    where: { id: { in: parsed.data.ids }, status: "pending" },
    data: { status: "rejected" },
  });

  res.json({ rejected: result.count });
});

export default router;
