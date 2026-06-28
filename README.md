# Codevia CRM

CRM interno de Codevia para gestionar clientes, citas, y captar leads automáticamente desde Google Maps.

## Estructura

- `backend/` — API en Node.js + Express + TypeScript + Prisma (PostgreSQL).
- `frontend/` — Aplicación React + TypeScript + Vite.
- `docker-compose.yml` — Levanta Postgres, backend y frontend juntos.

## Puesta en marcha (Docker)

1. Copia el archivo de variables de entorno:

   ```
   cp .env.example .env
   ```

2. (Opcional) Añade tu clave de Google Places API en `.env` (`GOOGLE_PLACES_API_KEY`). Sin ella, la búsqueda de leads usará automáticamente el scraping directo de Google Maps como alternativa.

3. Levanta todo el stack:

   ```
   docker compose up --build
   ```

4. Accede a:
   - Frontend: http://localhost:5173
   - API: http://localhost:4000/api/health

5. Inicia sesión con el usuario admin sembrado automáticamente (definido en `.env`, por defecto `admin@codevia.com` / `codevia123`). Cámbialo después del primer acceso.

## Cómo obtener una API key de Google Places

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita la API "Places API".
3. Crea una credencial de tipo API key y restringe su uso a Places API.
4. Copia la key en `GOOGLE_PLACES_API_KEY` dentro de `.env`.

Sin esta key configurada, el sistema usa un scraper con Playwright que navega Google Maps directamente. Es un mecanismo de respaldo: más lento y más frágil ante cambios de la interfaz de Google, pensado para no bloquear la captación de leads si no se ha configurado todavía la API oficial.

## Desarrollo local sin Docker

### Backend

```
cd backend
npm install
npx playwright install chromium
cp .env.example ../backend/.env   # ajusta DATABASE_URL a tu Postgres local
npx prisma migrate dev
npm run seed
npm run dev
```

### Frontend

```
cd frontend
npm install
npm run dev
```

## Módulos

- **Clientes**: alta/edición/baja, notas, filtros por estado/categoría/zona, conversión de lead → cliente.
- **Citas**: agenda vinculada a cada cliente, estados (pendiente, confirmada, completada, cancelada).
- **Captación Google Maps**: busca negocios por zona + categoría, usando la API oficial de Google Places (o el scraper de respaldo), y guarda los resultados como leads listos para gestionar.
