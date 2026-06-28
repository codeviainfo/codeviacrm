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

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/scrape", scrapeRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/services", servicesRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Codevia CRM backend escuchando en puerto ${port}`);
});
