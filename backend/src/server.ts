import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import clientsRoutes from "./routes/clients";
import appointmentsRoutes from "./routes/appointments";
import scrapeRoutes from "./routes/scrape";
import geocodeRoutes from "./routes/geocode";
import dashboardRoutes from "./routes/dashboard";
import servicesRoutes from "./routes/services";
import trackRoutes from "./routes/track";
import analyticsRoutes from "./routes/analytics";

const app = express();

// Detrás de nginx-proxy: necesario para que req.ip refleje la IP real
// del visitante (X-Forwarded-For) en la geolocalización de /api/track.
app.set("trust proxy", true);

app.use(cors());
// El body de /api/track llega como text/plain — se monta antes del parser JSON.
app.use("/api/track", trackRoutes);
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/scrape", scrapeRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/analytics", analyticsRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Codevia CRM backend escuchando en puerto ${port}`);
});
