import crypto from "crypto";
import { prisma } from "../lib/prisma";

const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

// Scopes necesarios para todo el flujo: leer el esquema de campos de una
// plantilla de marca, generar diseños por autofill, subir imágenes como
// assets y exportar el resultado final.
const CANVA_SCOPES = [
  "design:content:write",
  "design:meta:read",
  "design:content:read",
  "brandtemplate:content:read",
  "asset:write",
].join(" ");

interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export function isCanvaConfigured(): boolean {
  return Boolean(
    process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET && process.env.CANVA_REDIRECT_URI
  );
}

function basicAuthHeader(): string {
  return Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString(
    "base64"
  );
}

function generateCodeVerifier(): string {
  // base64url usa exactamente el charset permitido por PKCE (A-Z a-z 0-9 - _),
  // no hace falta filtrar caracteres. 48 bytes -> 64 caracteres, dentro del
  // rango 43-128 exigido.
  return crypto.randomBytes(48).toString("base64url");
}

function codeChallengeFromVerifier(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function buildAuthorizeUrl(
  redirectAfter?: string
): Promise<{ url: string; state: string }> {
  if (!isCanvaConfigured()) {
    throw new Error(
      "Canva no está configurado (faltan CANVA_CLIENT_ID/CANVA_CLIENT_SECRET/CANVA_REDIRECT_URI)"
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeFromVerifier(codeVerifier);
  const state = crypto.randomBytes(24).toString("hex");

  // El code_verifier debe vivir solo en el servidor (nunca en el navegador),
  // indexado por `state` para que el callback pueda recuperarlo.
  await prisma.canvaOAuthState.create({
    data: { state, codeVerifier, redirectAfter },
  });

  const params = new URLSearchParams({
    client_id: process.env.CANVA_CLIENT_ID as string,
    redirect_uri: process.env.CANVA_REDIRECT_URI as string,
    response_type: "code",
    scope: CANVA_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "s256",
    state,
  });

  return { url: `${CANVA_AUTHORIZE_URL}?${params.toString()}`, state };
}

async function saveConnection(
  tokenResponse: CanvaTokenResponse,
  connectedByUserId?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
  const existing = await prisma.canvaConnection.findFirst();

  const data = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    expiresAt,
    connectedByUserId: connectedByUserId ?? existing?.connectedByUserId,
  };

  if (existing) {
    await prisma.canvaConnection.update({ where: { id: existing.id }, data });
  } else {
    await prisma.canvaConnection.create({ data });
  }
}

// Intercambia el código de autorización por tokens y guarda/actualiza la
// fila única de CanvaConnection. Lanza si el `state` no coincide con un
// intento de conexión reciente (protección contra callbacks falsificados,
// ya que esta ruta no puede ir detrás de requireAuth).
export async function exchangeCodeForToken(
  code: string,
  state: string,
  connectedByUserId?: string
): Promise<void> {
  const pending = await prisma.canvaOAuthState.findUnique({ where: { state } });
  if (!pending) {
    throw new Error("Solicitud de conexión con Canva no encontrada o ya usada");
  }

  // Uso único: se borra antes de completar el intercambio, incluso si falla.
  await prisma.canvaOAuthState.delete({ where: { state } });

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (pending.createdAt < tenMinutesAgo) {
    throw new Error("La solicitud de conexión con Canva ha expirado, inténtalo de nuevo");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: pending.codeVerifier,
    redirect_uri: process.env.CANVA_REDIRECT_URI as string,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: body.toString(),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(
      `Canva OAuth token error: ${data.error_description || data.error || response.statusText}`
    );
  }

  await saveConnection(data as CanvaTokenResponse, connectedByUserId);
}

// Devuelve un access token válido, refrescándolo si está a punto de expirar.
// Los refresh tokens de Canva son de un solo uso: SIEMPRE se sobrescriben
// ambos tokens (access y refresh) con la respuesta del refresh — reutilizar
// el refresh token antiguo rompería la conexión en el siguiente intento.
export async function refreshAccessTokenIfNeeded(): Promise<string> {
  const connection = await prisma.canvaConnection.findFirst();
  if (!connection) {
    throw new Error("Canva no está conectado");
  }

  const oneMinuteFromNow = new Date(Date.now() + 60 * 1000);
  if (connection.expiresAt > oneMinuteFromNow) {
    return connection.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuthHeader()}`,
    },
    body: body.toString(),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(
      `Canva OAuth refresh error: ${data.error_description || data.error || response.statusText}`
    );
  }

  await saveConnection(data as CanvaTokenResponse, connection.connectedByUserId ?? undefined);
  return data.access_token;
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  scope?: string;
  expiresAt?: Date;
}> {
  const connection = await prisma.canvaConnection.findFirst();
  if (!connection) return { connected: false };
  return { connected: true, scope: connection.scope, expiresAt: connection.expiresAt };
}

export async function disconnectCanva(): Promise<void> {
  await prisma.canvaConnection.deleteMany({});
}
