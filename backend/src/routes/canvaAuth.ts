import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { buildAuthorizeUrl, exchangeCodeForToken, disconnectCanva } from "../services/canvaAuthService";

// Fichero separado de designs.ts (igual que track.ts está separado del
// resto) porque /callback NO puede ir detrás de requireAuth: el redirect
// de Canva es un GET del navegador sin cabecera Authorization.
const router = Router();

// Requiere sesión iniciada en el CRM — el usuario ya hizo login antes de
// pulsar "Conectar con Canva". Devuelve la URL de autorización en JSON en
// vez de un redirect 302, para mantener el patrón "botón -> llamada axios"
// del resto de la app.
router.get("/connect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const redirectAfter =
      typeof req.query.redirectAfter === "string" ? req.query.redirectAfter : undefined;
    const { url } = await buildAuthorizeUrl(redirectAfter);
    res.json({ url });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// SIN requireAuth: Canva redirige aquí con un GET del navegador, sin
// cabecera Authorization. La seguridad viene de que exchangeCodeForToken
// solo tiene éxito si el `state` coincide con un /connect reciente (ver
// canvaAuthService) — y se consume de un solo uso.
router.get("/callback", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const { code, state, error } = req.query;

  if (error || typeof code !== "string" || typeof state !== "string") {
    return res.redirect(`${frontendUrl}/designs?canva=error`);
  }

  try {
    await exchangeCodeForToken(code, state);
    res.redirect(`${frontendUrl}/designs?canva=connected`);
  } catch {
    res.redirect(`${frontendUrl}/designs?canva=error`);
  }
});

router.post("/disconnect", requireAuth, async (_req, res) => {
  await disconnectCanva();
  res.status(204).send();
});

export default router;
