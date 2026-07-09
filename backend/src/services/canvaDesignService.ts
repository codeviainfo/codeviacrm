import { refreshAccessTokenIfNeeded } from "./canvaAuthService";

const CANVA_API_BASE = "https://api.canva.com/rest/v1";

async function canvaRequest(path: string, accessToken: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${CANVA_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || data?.error?.message || response.statusText;
    throw new Error(`Canva API error (${response.status}) en ${path}: ${message}`);
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------ Brand templates */

export type BrandTemplateFieldType = "text" | "image" | "chart";

export async function getBrandTemplateDataset(
  canvaTemplateId: string
): Promise<Record<string, { type: BrandTemplateFieldType }>> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const data = await canvaRequest(`/brand-templates/${canvaTemplateId}/dataset`, accessToken);
  return data.dataset;
}

/* ------------------------------------------------------------- Autofill */

export type AutofillFieldValue = { type: "text"; text: string } | { type: "image"; asset_id: string };

export async function createAutofillJob(
  canvaTemplateId: string,
  title: string | undefined,
  data: Record<string, AutofillFieldValue>
): Promise<string> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const body = await canvaRequest("/autofills", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "create_from_brand_template",
      brand_template_id: canvaTemplateId,
      title,
      data,
    }),
  });
  return body.job.id;
}

export interface AutofillJobResult {
  status: "in_progress" | "success" | "failed";
  design?: { id: string; editUrl?: string; thumbnailUrl?: string };
  error?: { code: string; message: string };
}

export async function getAutofillJob(jobId: string): Promise<AutofillJobResult> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const data = await canvaRequest(`/autofills/${jobId}`, accessToken);
  const job = data.job;

  if (job.status === "success") {
    return {
      status: "success",
      design: {
        id: job.result.design.id,
        editUrl: job.result.design.urls?.edit_url,
        thumbnailUrl: job.result.design.thumbnail?.url,
      },
    };
  }
  if (job.status === "failed") {
    return { status: "failed", error: job.error };
  }
  return { status: "in_progress" };
}

/* --------------------------------------------------------- Asset upload */
// La Autofill API solo acepta asset_id en los campos de imagen, nunca una
// URL directa — hay que descargar el binario y subirlo a Canva primero.

export async function uploadAssetFromBinary(buffer: Buffer, fileName: string): Promise<string> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const metadata = JSON.stringify({ name_base64: Buffer.from(fileName).toString("base64") });
  const data = await canvaRequest("/asset-uploads", accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": metadata,
    },
    // Cast: los tipos de Buffer/BodyInit de Node no siempre coinciden entre
    // versiones de @types/node, aunque fetch acepta un Buffer perfectamente.
    body: buffer as any,
  });
  return data.job.id;
}

export interface AssetUploadJobResult {
  status: "in_progress" | "success" | "failed";
  assetId?: string;
}

export async function getAssetUploadJob(jobId: string): Promise<AssetUploadJobResult> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const data = await canvaRequest(`/asset-uploads/${jobId}`, accessToken);
  const job = data.job;
  if (job.status === "success") return { status: "success", assetId: job.asset?.id };
  if (job.status === "failed") return { status: "failed" };
  return { status: "in_progress" };
}

// Wrapper de conveniencia: descarga la imagen de una URL externa, la sube a
// Canva y sondea el job de subida (acotado) hasta obtener el asset_id final.
export async function uploadAssetFromUrl(sourceUrl: string, fileName: string): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen desde ${sourceUrl} (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const jobId = await uploadAssetFromBinary(buffer, fileName);

  for (let attempt = 0; attempt < 20; attempt++) {
    const job = await getAssetUploadJob(jobId);
    if (job.status === "success" && job.assetId) return job.assetId;
    if (job.status === "failed") throw new Error("Canva no pudo procesar la imagen subida");
    await sleep(500);
  }
  throw new Error("Tiempo de espera agotado subiendo la imagen a Canva");
}

/* --------------------------------------------------------------- Export */

export type ExportFormat = "png" | "pdf" | "jpg";

export async function createExportJob(canvaDesignId: string, format: ExportFormat): Promise<string> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const data = await canvaRequest("/exports", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ design_id: canvaDesignId, format: { type: format } }),
  });
  return data.job.id;
}

export interface ExportJobResult {
  status: "in_progress" | "success" | "failed";
  urls?: string[];
}

export async function getExportJob(jobId: string): Promise<ExportJobResult> {
  const accessToken = await refreshAccessTokenIfNeeded();
  const data = await canvaRequest(`/exports/${jobId}`, accessToken);
  return { status: data.job.status, urls: data.job.urls };
}

// Sondeo síncrono acotado tras iniciar una exportación — es una acción
// explícita del usuario ("Exportar"), donde una espera de varios segundos
// es UX esperada (a diferencia de la generación de diseño, que responde
// de inmediato y deja el sondeo al polling del frontend).
export async function pollExportJob(jobId: string): Promise<ExportJobResult> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const job = await getExportJob(jobId);
    if (job.status !== "in_progress") return job;
    await sleep(500);
  }
  return { status: "in_progress" };
}
