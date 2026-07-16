import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Client, Service } from "../api/types";

/** Only the fields the budget header actually needs — lets callers pass either
 *  a full Client or the lightweight { id, name, businessName } joined onto a Service. */
export type BudgetClient = Pick<Client, "name" | "businessName" | "email" | "phone" | "address" | "city">;

const BRAND_DARK = [24, 55, 127] as const; // brand-900
const BRAND_LABEL = [148, 163, 184] as const; // slate-400
const SLATE_TEXT = [30, 41, 59] as const; // slate-800
const SLATE_MUTED = [100, 116, 139] as const; // slate-500
const BORDER = [226, 232, 240] as const; // slate-200

function money(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

let logoDataUrlCache: string | null | undefined;

// The source logo is a ~1500px PNG for crisp display in the app UI, but the PDF only
// ever renders it at 14mm — embedding it at full resolution bloats the PDF to several MB.
const LOGO_EMBED_SIZE = 128;

async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlCache !== undefined) return logoDataUrlCache;
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_EMBED_SIZE;
    canvas.height = LOGO_EMBED_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const scale = Math.min(LOGO_EMBED_SIZE / bitmap.width, LOGO_EMBED_SIZE / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (LOGO_EMBED_SIZE - w) / 2, (LOGO_EMBED_SIZE - h) / 2, w, h);
    logoDataUrlCache = canvas.toDataURL("image/png");
  } catch {
    logoDataUrlCache = null;
  }
  return logoDataUrlCache;
}

/** Builds and downloads a real PDF budget ("presupuesto") for one client's services. */
export async function generateBudgetPdf(client: BudgetClient, services: Service[]) {
  const subtotal = services.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  const ref = `PRE-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;

  /* ---- header: logo + brand (left), presupuesto meta (right) ---- */
  const logo = await loadLogoDataUrl();
  const textX = logo ? marginX + 18 : marginX;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", marginX, 14, 14, 14);
    } catch {
      // malformed/undecodable image — fall back to text-only header
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_DARK);
  doc.text("Codevia", textX, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_MUTED);
  doc.text("codeviainfo@gmail.com  ·  codeviaesp.com", textX, 26.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...SLATE_TEXT);
  doc.text("PRESUPUESTO", pageWidth - marginX, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(`Ref: ${ref}`, pageWidth - marginX, 24, { align: "right" });
  doc.text(`Fecha: ${today}`, pageWidth - marginX, 29, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.line(marginX, 34, pageWidth - marginX, 34);

  /* ---- parties: De / Para ---- */
  const partyTop = 43;
  const paraX = pageWidth / 2 + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_LABEL);
  doc.text("DE", marginX, partyTop);
  doc.text("PARA", paraX, partyTop);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_TEXT);
  doc.text("Codevia", marginX, partyTop + 6);
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_MUTED);
  doc.text("codeviainfo@gmail.com", marginX, partyTop + 11);

  const clientName = client.businessName || client.name;
  const paraLines = [
    client.name !== clientName ? client.name : null,
    client.email,
    client.phone,
    [client.address, client.city].filter(Boolean).join(", ") || null,
  ].filter((l): l is string => Boolean(l));

  doc.setFontSize(10);
  doc.setTextColor(...SLATE_TEXT);
  doc.text(clientName, paraX, partyTop + 6);
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_MUTED);
  paraLines.forEach((line, i) => doc.text(line, paraX, partyTop + 11 + i * 4.5));

  const tableStartY = partyTop + 11 + Math.max(paraLines.length, 1) * 4.5 + 6;

  /* ---- line items ---- */
  autoTable(doc, {
    startY: tableStartY,
    head: [["Descripción", "Cant.", "Precio unit.", "Total"]],
    body: services.map((s) => [
      s.description ? `${s.title}\n${s.description}` : s.title,
      String(s.quantity),
      money(s.unitPrice),
      money(s.quantity * s.unitPrice),
    ]),
    styles: { font: "helvetica", fontSize: 9, textColor: SLATE_TEXT as unknown as [number, number, number], cellPadding: 3 },
    headStyles: { fillColor: BRAND_DARK as unknown as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "right", cellWidth: 18 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 28 },
    },
    margin: { left: marginX, right: marginX },
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (finalY + 40 > pageHeight) {
    doc.addPage();
    finalY = 20;
  }

  /* ---- totals ---- */
  const totalsLabelX = pageWidth - marginX - 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_MUTED);
  doc.text("Subtotal", totalsLabelX, finalY);
  doc.text(money(subtotal), pageWidth - marginX, finalY, { align: "right" });
  doc.text("IVA (21%)", totalsLabelX, finalY + 6);
  doc.text(money(iva), pageWidth - marginX, finalY + 6, { align: "right" });

  doc.setDrawColor(...BRAND_DARK);
  doc.line(totalsLabelX, finalY + 9, pageWidth - marginX, finalY + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SLATE_TEXT);
  doc.text("TOTAL", totalsLabelX, finalY + 16);
  doc.text(money(total), pageWidth - marginX, finalY + 16, { align: "right" });

  /* ---- footer ---- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(
    "Presupuesto válido por 30 días · Codevia — Desarrollo de software y automatización empresarial",
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );

  const ACCENTS: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ñ: "n", ü: "u" };
  const slug = clientName
    .toLowerCase()
    .split("")
    .map((c) => ACCENTS[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`presupuesto-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
