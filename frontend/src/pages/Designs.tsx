import { FormEvent, useEffect, useState } from "react";
import { api, apiBaseUrl } from "../api/client";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  Spinner,
  Textarea,
} from "../components/ui";
import { IconDownload, IconPalette, IconSparkle, IconTrash } from "../components/icons";
import { Design, DesignCategory } from "../api/types";

const categoryTabs: Array<[DesignCategory, string]> = [
  ["flyer", "Flyers"],
  ["social_post", "Redes sociales"],
  ["banner", "Banners"],
];

const categoryLabels: Record<DesignCategory, string> = {
  flyer: "Flyer",
  social_post: "Post redes sociales",
  banner: "Banner",
};

export function Designs() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [category, setCategory] = useState<DesignCategory>("flyer");
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [generating, setGenerating] = useState(false);

  const [designs, setDesigns] = useState<Design[]>([]);

  function loadDesigns() {
    api.get<Design[]>("/designs").then((res) => setDesigns(res.data));
  }

  useEffect(() => {
    loadDesigns();
  }, []);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/designs", {
        category,
        title: title || undefined,
        brief,
        referenceImageUrl: referenceImageUrl || undefined,
      });
      setMessage("Diseño generado correctamente.");
      setBrief("");
      setTitle("");
      setReferenceImageUrl("");
      loadDesigns();
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo generar el diseño");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/designs/${id}`);
    loadDesigns();
  }

  return (
    <div>
      <PageHeader
        title="Contenido y diseño"
        subtitle="Genera flyers, posts y banners de marca con IA, directamente desde el CRM."
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-6 animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      {/* Generación */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex gap-1 border-b border-slate-100 px-3 pt-3">
          {categoryTabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={
                "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors " +
                (category === key ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-800")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate} className="grid gap-4 p-5">
          <Field label="Describe qué quieres generar *">
            <Textarea
              required
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Ej: Promoción de verano, 20% de descuento en desarrollo web, tono cercano y directo"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título / texto principal (opcional)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: -20% este verano" />
            </Field>
            <Field label="URL de imagen de referencia (opcional)">
              <Input
                type="url"
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={generating || !brief.trim()}>
              {generating ? (
                <>
                  <Spinner className="h-4 w-4" /> Generando… (puede tardar unos segundos)
                </>
              ) : (
                <>
                  <IconSparkle className="h-4 w-4" /> Generar con IA
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Historial */}
      <Card className="overflow-hidden">
        <CardHeader title="Historial de diseños" subtitle="Generados con IA a partir de tus descripciones." />
        {designs.length === 0 ? (
          <EmptyState
            icon={<IconPalette />}
            title="Todavía no has generado ningún diseño"
            description="Describe arriba lo que quieres y genera tu primer flyer, post o banner."
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => {
              const imageUrl = `${apiBaseUrl}/designs/${d.id}/image`;
              return (
                <div key={d.id} className="overflow-hidden rounded-xl border border-slate-200/80">
                  <div className="flex aspect-video items-center justify-center bg-slate-50">
                    {d.status === "success" ? (
                      <img src={imageUrl} alt={d.title || "Diseño"} className="h-full w-full object-cover" />
                    ) : d.status === "pending" ? (
                      <Spinner className="h-6 w-6 text-slate-300" />
                    ) : (
                      <IconPalette className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {d.title || categoryLabels[d.category]}
                      </p>
                      <Pill tone={d.status}>
                        {d.status === "pending" ? "Generando" : d.status === "success" ? "Listo" : "Error"}
                      </Pill>
                    </div>
                    {d.status === "failed" && d.errorMessage && (
                      <p className="mb-2 text-xs text-red-600">{d.errorMessage}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.status === "success" && (
                        <a
                          href={imageUrl}
                          download={`${d.title || d.category}.png`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <IconDownload className="h-4 w-4" /> Descargar
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(d.id)}
                        title="Borrar"
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
