import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Field, Input } from "../components/ui";
import { IconSparkle } from "../components/icons";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(40rem 40rem at 80% -10%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(30rem 30rem at -10% 110%, rgba(255,255,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-soft">
            <img src="/logo.png" alt="Codevia" className="h-7 w-7 object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Codevia CRM</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white">
            Gestiona clientes y capta leads en automático.
          </h2>
          <p className="mt-4 text-brand-100">
            Centraliza tus clientes, agenda citas y genera nuevas oportunidades extrayendo
            negocios de Google Maps por zona y categoría.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm font-medium text-brand-100">
            <IconSparkle className="h-5 w-5" />
            Captación de leads impulsada por automatización
          </div>
        </div>

        <p className="relative text-xs text-brand-200">
          © {new Date().getFullYear()} Codevia · Software & Business Automation
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <img src="/logo.png" alt="Codevia" className="mb-3 h-10 w-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-slate-500">Inicia sesión para acceder a tu panel.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@codevia.com"
                required
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando…" : "Iniciar sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
