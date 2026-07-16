import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const DESIGN_DIMENSIONS = {
  flyer: { width: 1240, height: 1754 }, // A4 ~150dpi, apto para imprimir
  social_post: { width: 1080, height: 1080 }, // cuadrado universal
  banner: { width: 1200, height: 628 }, // banner web/email estándar
} as const;

export type DesignCategoryKey = keyof typeof DESIGN_DIMENSIONS;

const CATEGORY_LABELS: Record<DesignCategoryKey, string> = {
  flyer: "flyer",
  social_post: "publicación para redes sociales",
  banner: "banner web/email",
};

// tsc no copia ficheros no-.ts a dist/, así que el logo se resuelve desde la
// carpeta src/ relativa al WORKDIR (/app) en vez de __dirname — funciona
// igual en dev (tsx corre desde src/) y en producción (COPY . . conserva
// src/ junto a dist/ en la imagen).
const LOGO_PATH = path.join(process.cwd(), "src", "assets", "logo.png");

function logoDataUri(): string {
  const buffer = fs.readFileSync(LOGO_PATH);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function buildSystemPrompt(width: number, height: number): string {
  return `Eres un diseñador gráfico experto en marketing digital para la empresa Codevia (servicios de desarrollo web y tecnología).

Vas a generar el HTML de una pieza de contenido de marca. Reglas estrictas:

- Responde ÚNICAMENTE con un documento HTML completo (<!DOCTYPE html>...</html>). Nada de explicaciones, nada de bloques de código markdown (sin \`\`\`).
- Todo el CSS va inline en un <style> dentro de <head>. No uses fuentes externas (Google Fonts, CDNs) ni ningún recurso por red salvo la imagen de referencia que se te indique — usa system-ui/"Segoe UI"/sans-serif.
- El <body> debe medir EXACTAMENTE ${width}px de ancho por ${height}px de alto: <body style="width:${width}px;height:${height}px;margin:0;overflow:hidden;position:relative;">.
- Paleta de marca de Codevia (úsala como eje del diseño): azul principal #2f6bff, azul oscuro #1a56f0, azul muy claro #eef5ff (fondo), texto oscuro #0f172a, blanco #ffffff.
- Incluye el logo de Codevia en una esquina (tamaño discreto, no dominante) con exactamente esta etiqueta: <img src="{{LOGO}}" style="posición y tamaño a tu criterio"/>. No cambies el valor "{{LOGO}}", se sustituye después por el logo real.
- Si se te da una URL de imagen de referencia, incorpórala en el diseño (como fondo, foto recortada o elemento visual) usando esa URL exacta en un <img> o background-image.
- El diseño debe verse profesional, con jerarquía visual clara (titular, texto de apoyo, llamada a la acción si aplica), buen contraste y espaciado.`;
}

export async function generateDesignHtml(input: {
  category: DesignCategoryKey;
  brief: string;
  title?: string;
  referenceImageUrl?: string;
}): Promise<string> {
  const { width, height } = DESIGN_DIMENSIONS[input.category];
  const client = new Anthropic();

  const userLines = [
    `Tipo de pieza: ${CATEGORY_LABELS[input.category]} (${width}x${height}px).`,
    `Descripción/brief: ${input.brief}`,
  ];
  if (input.title) userLines.push(`Título/texto principal sugerido: ${input.title}`);
  if (input.referenceImageUrl) {
    userLines.push(`URL de imagen de referencia a incorporar: ${input.referenceImageUrl}`);
  }

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(width, height),
    messages: [{ role: "user", content: userLines.join("\n") }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    throw new Error("Claude no devolvió contenido de texto");
  }

  let html = textBlock.text.trim();
  // Por si Claude envuelve la respuesta en un bloque de código pese a la instrucción.
  const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenceMatch) html = fenceMatch[1].trim();

  if (!html.toLowerCase().includes("<html")) {
    throw new Error("La respuesta de Claude no contenía un documento HTML válido");
  }

  return html.replace(/\{\{LOGO\}\}/g, logoDataUri());
}
