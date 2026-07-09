import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
  Spinner,
} from "../components/ui";
import {
  IconDownload,
  IconEdit,
  IconExternal,
  IconPalette,
  IconPlus,
  IconSparkle,
  IconTrash,
} from "../components/icons";
import {
  BrandTemplate,
  BrandTemplateCategory,
  CanvaConnectionStatus,
  Design,
} from "../api/types";

const categoryLabels: Record<BrandTemplateCategory, string> = {
  flyer: "Flyers",
  social_post: "Redes sociales",
  banner: "Banners",
};

type FieldValue = { type: "text"; text: string } | { type: "image"; url: string };

export function Designs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [canvaStatus, setCanvaStatus] = useState<CanvaConnectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [allTemplates, setAllTemplates] = useState<BrandTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState({
    canvaTemplateId: "",
    name: "",
    category: "flyer" as BrandTemplateCategory,
  });
  const [registering, setRegistering] = useState(false);

  const [category, setCategory] = useState<BrandTemplateCategory>("flyer");
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [designTitle, setDesignTitle] = useState("");
  const [generating, setGenerating] = useState(false);

  const [designs, setDesigns] = useState<Design[]>([]);
  const pollAttemptsRef = useRef(0);

  function loadStatus() {
    api.get<CanvaConnectionStatus>("/designs/status").then((res) => setCanvaStatus(res.data));
  }

  function loadAllTemplates() {
    api.get<BrandTemplate[]>("/designs/templates").then((res) => setAllTemplates(res.data));
  }

  function loadTemplatesForCategory(cat: BrandTemplateCategory) {
    api
      .get<BrandTemplate[]>("/designs/templates", { params: { category: cat } })
      .then((res) => setTemplates(res.data));
  }

  function loadDesigns() {
    api.get<Design[]>("/designs").then((res) => setDesigns(res.data));
  }

  useEffect(() => {
    loadStatus();
    loadAllTemplates();
    loadDesigns();
  }, []);

  useEffect(() => {
    loadTemplatesForCategory(category);
    setSelectedTemplateId(null);
  }, [category]);

  useEffect(() => {
    setFieldValues({});
    setDesignTitle("");
  }, [selectedTemplateId]);

  // Lee ?canva=connected|error tras volver del redirect de Canva y limpia
  // el parámetro para no repetir el aviso si se recarga la página.
  useEffect(() => {
    const canva = searchParams.get("canva");
    if (canva === "connected") {
      setMessage("Conectado con Canva correctamente.");
      loadStatus();
    } else if (canva === "error") {
      setError("No se pudo completar la conexión con Canva. Inténtalo de nuevo.");
    }
    if (canva) {
      searchParams.delete("canva");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling ligero mientras haya algún diseño "pending" — acotado a ~40
  // intentos (~100s) para no seguir consultando indefinidamente si algo se
  // quedó atascado.
  useEffect(() => {
    const hasPending = designs.some((d) => d.status === "pending");
    if (!hasPending) {
      pollAttemptsRef.current = 0;
      return;
    }
    if (pollAttemptsRef.current >= 40) return;
    const timer = setTimeout(() => {
      pollAttemptsRef.current += 1;
      loadDesigns();
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designs]);

  async function handleConnect() {
    try {
      const { data } = await api.get<{ url: string }>("/canva/connect");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo iniciar la conexión con Canva");
    }
  }

  async function handleDisconnect() {
    await api.post("/canva/disconnect");
    loadStatus();
  }

  async function handleRegisterTemplate(e: FormEvent) {
    e.preventDefault();
    setRegistering(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/designs/templates", templateForm);
      setMessage("Plantilla registrada correctamente.");
      setTemplateForm({ canvaTemplateId: "", name: "", category: templateForm.category });
      loadAllTemplates();
      if (templateForm.category === category) loadTemplatesForCategory(category);
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo registrar la plantilla");
    } finally {
      setRegistering(false);
    }
  }

  async function handleDeactivateTemplate(id: string) {
    await api.patch(`/designs/templates/${id}`, { active: false });
    loadAllTemplates();
    loadTemplatesForCategory(category);
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const fields: Record<string, FieldValue> = {};
      for (const [key, field] of Object.entries(selectedTemplate.fieldSchema)) {
        const value = fieldValues[key];
        if (!value) continue;
        if (field.type === "text") fields[key] = { type: "text", text: value };
        else if (field.type === "image") fields[key] = { type: "image", url: value };
      }
      await api.post("/designs", {
        brandTemplateId: selectedTemplate.id,
        title: designTitle || undefined,
        fields,
      });
      setMessage("Generando diseño… aparecerá en el historial en unos segundos.");
      pollAttemptsRef.current = 0;
      loadDesigns();
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo generar el diseño");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport(id: string, format: "png" | "pdf") {
    setError(null);
    try {
      await api.post(`/designs/${id}/export`, { format });
      loadDesigns();
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo exportar el diseño");
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
        subtitle="Genera flyers, posts y banners de marca a partir de plantillas de Canva."
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

      {/* Conexión con Canva */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title="Conexión con Canva"
          subtitle={
            canvaStatus?.connected
              ? "Cuenta de Canva conectada."
              : "Conecta la cuenta de Canva de Codevia para poder generar diseños."
          }
          action={
            canvaStatus?.connected ? (
              <Button variant="secondary" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnect}>
                Conectar con Canva
              </Button>
            )
          }
        />
      </Card>

      {/* Registro de plantillas de marca */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title="Plantillas de marca"
          subtitle="Regístralas pegando el ID de la plantilla ya creada en Canva."
        />
        <form onSubmit={handleRegisterTemplate} className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-4">
          <Field label="ID de plantilla en Canva *" className="sm:col-span-2">
            <Input
              required
              value={templateForm.canvaTemplateId}
              onChange={(e) => setTemplateForm((p) => ({ ...p, canvaTemplateId: e.target.value }))}
              placeholder="Ej: DAFxxxxxxxx"
            />
          </Field>
          <Field label="Nombre *">
            <Input
              required
              value={templateForm.name}
              onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Flyer promoción"
            />
          </Field>
          <Field label="Categoría *">
            <Select
              value={templateForm.category}
              onChange={(e) =>
                setTemplateForm((p) => ({ ...p, category: e.target.value as BrandTemplateCategory }))
              }
            >
              <option value="flyer">Flyer</option>
              <option value="social_post">Post redes sociales</option>
              <option value="banner">Banner</option>
            </Select>
          </Field>
          <div className="flex items-end sm:col-span-4">
            <Button type="submit" size="sm" disabled={registering}>
              {registering ? (
                <>
                  <Spinner className="h-4 w-4" /> Registrando…
                </>
              ) : (
                <>
                  <IconPlus className="h-4 w-4" /> Registrar plantilla
                </>
              )}
            </Button>
          </div>
        </form>

        {allTemplates.length === 0 ? (
          <EmptyState icon={<IconPalette />} title="Todavía no has registrado ninguna plantilla" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {allTemplates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {categoryLabels[t.category]} · {t.canvaTemplateId}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeactivateTemplate(t.id)}>
                  Desactivar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Generación por categoría */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex gap-1 border-b border-slate-100 px-3 pt-3">
          {(
            [
              ["flyer", "Flyers"],
              ["social_post", "Redes sociales"],
              ["banner", "Banners"],
            ] as const
          ).map(([key, label]) => (
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

        <div className="p-5">
          <Field label="Plantilla">
            <Select
              value={selectedTemplateId ?? ""}
              onChange={(e) => setSelectedTemplateId(e.target.value || null)}
            >
              <option value="">Elige una plantilla…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          {templates.length === 0 && (
            <p className="mt-3 text-xs text-slate-400">
              No hay plantillas de tipo "{categoryLabels[category]}" — regístralas arriba.
            </p>
          )}
        </div>

        {selectedTemplate && (
          <form onSubmit={handleGenerate} className="border-t border-slate-100 p-5">
            <Field label="Título (opcional)" className="mb-4">
              <Input
                value={designTitle}
                onChange={(e) => setDesignTitle(e.target.value)}
                placeholder="Ej: Flyer verano 2026"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(selectedTemplate.fieldSchema)
                .filter(([, field]) => field.type !== "chart")
                .map(([key, field]) => (
                  <Field key={key} label={field.type === "image" ? `${key} (URL de imagen)` : key}>
                    <Input
                      type={field.type === "image" ? "url" : "text"}
                      value={fieldValues[key] ?? ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={field.type === "image" ? "https://…" : undefined}
                    />
                  </Field>
                ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={generating}>
                {generating ? (
                  <>
                    <Spinner className="h-4 w-4" /> Generando…
                  </>
                ) : (
                  <>
                    <IconSparkle className="h-4 w-4" /> Generar diseño
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Historial */}
      <Card className="overflow-hidden">
        <CardHeader title="Historial de diseños" subtitle="Generados a partir de tus plantillas de marca." />
        {designs.length === 0 ? (
          <EmptyState
            icon={<IconPalette />}
            title="Todavía no has generado ningún diseño"
            description="Elige una plantilla arriba y genera tu primer flyer, post o banner."
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => {
              const thumbnailFresh =
                d.status === "success" &&
                d.thumbnailUrl &&
                Date.now() - new Date(d.updatedAt).getTime() < 14 * 60 * 1000;

              return (
                <div key={d.id} className="overflow-hidden rounded-xl border border-slate-200/80">
                  <div className="flex aspect-video items-center justify-center bg-slate-50">
                    {thumbnailFresh ? (
                      <img
                        src={d.thumbnailUrl as string}
                        alt={d.title || "Diseño"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconPalette className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {d.title || d.brandTemplate?.name || "Sin título"}
                      </p>
                      <Pill tone={d.status}>
                        {d.status === "pending" ? "Generando" : d.status === "success" ? "Listo" : "Error"}
                      </Pill>
                    </div>
                    {d.status === "failed" && d.errorMessage && (
                      <p className="mb-2 text-xs text-red-600">{d.errorMessage}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.editUrl && (
                        <a
                          href={d.editUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <IconEdit className="h-4 w-4 text-brand-600" /> Editar
                        </a>
                      )}
                      {d.status === "success" && (
                        <>
                          <button
                            onClick={() => handleExport(d.id, "png")}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <IconDownload className="h-4 w-4" /> PNG
                          </button>
                          <button
                            onClick={() => handleExport(d.id, "pdf")}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <IconDownload className="h-4 w-4" /> PDF
                          </button>
                        </>
                      )}
                      {d.exportedFileUrl && (
                        <a
                          href={d.exportedFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          <IconExternal className="h-4 w-4" /> Descargar
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
