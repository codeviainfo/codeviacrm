import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { searchCities } from "../services/geocodeService";

const router = Router();
router.use(requireAuth);

// GET /api/geocode/cities?q= — city suggestions for the autocomplete (Nominatim).
router.get("/cities", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (q.trim().length < 2) return res.json([]);
  try {
    const cities = await searchCities(q);
    res.json(cities);
  } catch (err: any) {
    res.status(502).json({ error: "No se pudo consultar el servicio de ciudades", details: err.message });
  }
});

export default router;
