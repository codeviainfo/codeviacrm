# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Codevia CRM — internal CRM for Codevia (software dev / business automation company). Three functional pillars:
1. Client + appointment management (CRUD).
2. Automated lead generation by scraping Google Maps by zone + business category.
3. Brand content generation (flyers, social posts, banners) via the Claude API + server-side HTML rendering, independent of the Client/Lead data — used to produce marketing material for traffic/lead generation, not to manage leads.

Branding/theming is applied via Tailwind CSS. The Codevia brand blue is derived from `logoCODEVIA.png` (copied to `frontend/public/logo.png`) and defined as the `brand` color scale in `frontend/tailwind.config.js`. The UI uses Inter (loaded in `index.html`) and a shared component system in `frontend/src/components/ui.tsx` + `icons.tsx` — reuse those primitives (`Button`, `Card`, `Field`, `Input`/`Select`/`Textarea`, `StatusBadge`, `PageHeader`, etc.) instead of writing ad-hoc markup.

## Architecture

```
/backend   Node + Express + TypeScript + Prisma + PostgreSQL
/frontend  React + TypeScript + Vite
docker-compose.yml orchestrates postgres + backend + frontend
```

**Backend** (`backend/src`):
- `server.ts` wires routes: `/api/auth`, `/api/clients`, `/api/appointments`, `/api/scrape`, `/api/geocode`, `/api/dashboard`, `/api/health`, `/api/designs`.
- `middleware/auth.ts` — JWT bearer auth (`requireAuth`), sets `req.userId`. All routes except `/auth/login` and `/health` require it.
- `lib/prisma.ts` — shared `PrismaClient` instance.
- `routes/geocode.ts` — `GET /geocode/cities?q=` proxies `services/geocodeService.ts` (free Nominatim/OpenStreetMap search) for the frontend city autocomplete. Proxied through the backend to satisfy Nominatim's required `User-Agent` and avoid browser CORS/rate-limit issues.
- `routes/scrape.ts` is the core of the lead-gen feature. Two entry points feed the **same** `ScrapeCandidate` pipeline via the shared `saveCandidates()` helper: (1) `POST /scrape` (text search by zone+category) tries `services/googlePlacesService.ts` (official Places API) first if `GOOGLE_PLACES_API_KEY` is set, otherwise falls back to `services/mapsScraperService.ts` (Playwright); (2) `POST /scrape/area` (body `{polygon:[[lat,lon],...], category, cityLabel?}`) captures every business inside a user-drawn polygon via `services/overpassService.ts` (free OpenStreetMap/Overpass — supports polygon queries natively, no API key, but has **no rating/review data** and approximate category→OSM-tag mapping). Each run is tracked as a `ScrapeJob` row (pending → running → completed/failed; `source` is `google_places_api`/`playwright_fallback`/`overpass`).
- **Scrape → review → promote flow**: `POST /scrape` does **not** create `Client` rows. Every business found is saved (deduped within the run by `googlePlaceId` or name+address) as a `ScrapeCandidate` with `status=pending`, linked to the `ScrapeJob`. The user reviews candidates in the frontend (filter by `hasWebsite`, search, per-search), then `POST /scrape/candidates/accept` (body `{ids:[]}`) promotes the selected pending candidates into `Client` rows with `status=lead`, `source=google_maps` (skipping any that already exist as a Client by `googlePlaceId`/name+address, and stamping `clientId` back on the candidate), while `POST /scrape/candidates/reject` marks them `rejected`. `GET /scrape/candidates` supports `jobId`, `status`, `hasWebsite`, `search` filters. The `hasWebsite` flag depends on the `website` field, which the Places API path always fills but the Playwright path only fills best-effort (the result card's Website button anchor — brittle, may be absent).
- **Web analytics** (`routes/track.ts` + `routes/analytics.ts`): first-party, cookieless analytics for the public landing (codeviaesp.com). `POST /api/track` is the only unauthenticated route besides `/auth/login` and `/health` — it receives anonymous events (pageview, cta_click, form_start, form_submit, form_error) as **text/plain** bodies (parsed manually; sent that way by the landing to avoid a CORS preflight and allow `keepalive`), so it is mounted in `server.ts` **before** `express.json()`. Sessions (`WebSession`, id generated client-side) store country (derived from IP via `fast-geoip` — chosen over `geoip-lite` because it reads data from disk per lookup instead of holding ~100 MB in RAM, which the 1 GB VPS can't afford; IP itself never persisted), referrer hostname, UTM params, device and language; events (`WebEvent`) reference them. `app.set("trust proxy", true)` is required for the real visitor IP behind nginx-proxy. In-memory per-IP rate limit (120 events/min). `GET /api/analytics/summary?days=N` (auth) aggregates everything for the CRM's "Web Analytics" page (`frontend/src/pages/WebAnalytics.tsx`, route `/analytics`). The emitting snippet lives in the landing repo at `src/lib/analytics.js`.
- **Important**: leads and clients are the *same* `Client` model, distinguished by `status` (`lead|prospect|client|inactive`) and `source` (`manual|google_maps`). There is no separate Lead table — converting a lead to a client is just a status update. `ScrapeCandidate` is a *staging* table that sits **before** the lead stage; it is not a Client and is safe to discard.
- **Content/Design module** (`routes/designs.ts`, services `claudeDesignService.ts` + `designRenderService.ts`) — the only feature independent of the Client/Lead data. Generation is **synchronous**: `POST /api/designs` (1) calls `claudeDesignService.generateDesignHtml()`, which sends Codevia's brand guidelines (colors, logo, tone) as a system prompt to the Claude API (`claude-opus-4-8`, `@anthropic-ai/sdk`) and asks for a complete self-contained HTML/CSS document sized exactly to the category's pixel dimensions (`DESIGN_DIMENSIONS`: flyer 1240x1754, social_post 1080x1080, banner 1200x628); (2) renders that HTML to a PNG with `designRenderService.renderHtmlToPng()` (Playwright Chromium — the same dependency already used by `mapsScraperService.ts`, no new infra); (3) stores the PNG directly in Postgres as `Design.imageData` (`Bytes`) rather than a file volume/static server, since this internal tool's expected volume is low. There is **no Canva dependency and no OAuth** — Canva's Connect API was evaluated but its public API only supports template-based generation (`brand_template` autofill), not free-form AI generation, and Brand Templates additionally require a Canva Teams/Enterprise account; Claude API + server-rendered HTML avoids both constraints. The logo is baked into the backend image at `backend/src/assets/logo.png` and read via `fs.readFileSync(path.join(process.cwd(), "src/assets/logo.png"))` rather than `__dirname`-relative (tsc doesn't copy non-`.ts` files into `dist/`, so the path is resolved relative to the container's `WORKDIR` instead, which holds both `src/` and `dist/`). `GET /api/designs/:id/image` is registered **before** `router.use(requireAuth)` in `designs.ts` and is deliberately unauthenticated — an `<img src>` tag cannot send a `Bearer` header, so this route relies on the UUID being unguessable (same trust model as `/api/track`).

**Database** (`backend/prisma/schema.prisma`): `User`, `Client` (has unique `googlePlaceId`, `latitude`/`longitude`/`googleMapsUrl` for location, indexed on `status`/`category`/`zone`), `Appointment` (FK to Client with cascade delete, indexed on `scheduledAt`), `ScrapeJob` (has `candidates` relation), `ScrapeCandidate` (FK to ScrapeJob with cascade delete, has `latitude`/`longitude`, `status=pending|accepted|rejected`, indexed on `jobId`/`status`/`hasWebsite`). On accept, the candidate's `phone`/`latitude`/`longitude`/`googleMapsUrl` are carried onto the new `Client`. `Design` (`category=flyer|social_post|banner`, `status=pending|success|failed`, `imageData` is a `Bytes` column holding the rendered PNG directly — the only binary column in this schema).

- Migrations are committed to `backend/prisma/migrations/` and applied via `prisma migrate deploy` in the Docker `CMD` chain — **migrations must exist in source control**, they are not generated at deploy time. To add a new migration when developing without a local Postgres, generate it against the real `postgres` service: start `docker compose up -d postgres`, then `docker compose run --rm backend npx prisma migrate dev --name <name>`, then copy the resulting folder from the container into `backend/prisma/migrations/` on the host and commit it (`docker compose run` mounts nothing back automatically — use `docker cp` from a named run, or rebuild after generating with `--create-only` and applying via `migrate deploy` locally if you have Postgres reachable from the host).

**Frontend** (`frontend/src`): React + Vite + **Tailwind CSS**. React Router v6 routes in `App.tsx` — `/login` standalone, everything else nested under `Layout.tsx` (fixed sidebar nav + responsive mobile top bar, redirects to `/login` if no user). `context/AuthContext.tsx` holds the JWT/user in `localStorage` (`codevia_token`, `codevia_user`). `api/client.ts` is an Axios instance that injects the bearer token and redirects to `/login` on 401. Pages: `Dashboard`, `Clients` (+ `ClientDetail`), `Appointments`, `Scraper`, `Designs`. Shared UI primitives live in `components/ui.tsx` (note: `StatusBadge` is exported from here, not from `Clients.tsx`) and SVG icons in `components/icons.tsx`. Styling is utility-first Tailwind in JSX; `index.css` only holds the `@tailwind` directives + minimal base styles. Tailwind config (`brand` colors, fonts, shadows) is in `frontend/tailwind.config.js`. There is no Modal/Dialog/Tabs component — tab switchers are hand-rolled inline (`useState` + `.map()` over a `[key, label]` tuple array), see `Scraper.tsx` and `Designs.tsx`.

- The `Scraper` page has two tabs that both feed the same candidate-review table: **Por texto** (city + category — the city field is `components/CityAutocomplete.tsx`, backed by `/geocode/cities`, and *requires* picking a suggestion before searching) and **Por zona en mapa** (`AreaScraper` + `components/MapDraw.tsx`, a vanilla-Leaflet + leaflet-draw map for drawing a polygon, posting to `/scrape/area`). Maps links are built by the shared `lib/maps.ts` (`mapsHref`/`hasLocation`), reused by `Clients` and `ClientDetail` for the "Ver en Google Maps" location links.
- The `Designs` page (route `/designs`) is the Content/Design module's UI: a Flyers/Redes sociales/Banners tab switcher (hand-rolled, same pattern as `Scraper.tsx`), a form (brief text, optional title, optional reference-image URL) that `POST`s to `/api/designs` and **awaits the response directly** (generation is synchronous — no polling, since there's no async job to wait on), and a history grid rendering each design's image via `<img src="{apiBaseUrl}/designs/:id/image">` (that endpoint is unauthenticated by design, see above) with a status `Pill`, download link, and delete button.

## Commands

Docker is the primary workflow (no top-level `package.json` — each app has its own):

```bash
docker compose up --build      # build + run postgres, backend, frontend
docker compose up -d           # run in background
docker compose build backend   # rebuild a single service after code changes
docker compose logs backend --tail=100
docker compose ps
```

Backend (`cd backend`):
```bash
npm run dev              # tsx watch, local dev (needs DATABASE_URL pointing at a reachable Postgres)
npm run build             # tsc -p tsconfig.json
npm run prisma:migrate:dev   # prisma migrate dev (generates + applies, use during schema changes)
npm run prisma:migrate       # prisma migrate deploy (apply-only, used in Docker CMD)
npm run seed              # seeds admin user from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD env vars (idempotent)
npx playwright install chromium   # required once for local (non-Docker) scraper runs
```

Frontend (`cd frontend`):
```bash
npm run dev       # vite dev server
npm run build      # tsc -b && vite build
```

No test suite exists yet in either project.

## Known fragile points

- `services/geocodeService.ts` (Nominatim) and `services/overpassService.ts` (Overpass) hit **free public OpenStreetMap endpoints** with usage policies (~1 req/s, descriptive `User-Agent` required — already set). Fine for internal/low-volume use; not for high throughput. Overpass has no rating/review data, and the category→OSM-tag mapping in `overpassService.ts` (`CATEGORY_MAP`) is a curated dictionary with a name-based fallback — uncommon categories may return few/no results.
- `components/MapDraw.tsx` uses **vanilla Leaflet + leaflet-draw** via a ref (not react-leaflet) and re-points Leaflet's default marker icons at the bundled PNGs (the well-known Leaflet+bundler icon-404 issue). `leaflet` and `leaflet-draw` CSS are imported there.
- `backend/package.json` pins `playwright` to an **exact** version (`1.48.0`, no `^`) because it must match the Playwright browser binaries baked into the `mcr.microsoft.com/playwright:v1.48.0-jammy` base image used in `backend/Dockerfile`. If you bump the playwright npm version, bump the Dockerfile base image tag to match (and vice versa) — a mismatch fails Chromium launch with a `browserType.launch: Executable doesn't exist` error surfaced as a 502 on `/api/scrape`.
- `mapsScraperService.ts` sets a `CONSENT=YES+` cookie before navigating to Google Maps to skip the GDPR consent interstitial; without it the results feed never loads and scraping silently returns 0 results (no error thrown).
- `frontend/Dockerfile` copies the full `node_modules` from the build stage into the runtime stage and invokes `./node_modules/.bin/vite` directly — do not switch this to `npx vite` or a fresh `npm install --omit=dev` in the runtime stage, since that resolves whatever the latest vite version is at container start time instead of the pinned one, causing slow/flaky startups.
- The Google Maps scraper fallback extracts address text via a CSS selector (`.W4Efsd span`) that currently captures extra noise (rating, category, opening hours mixed into the same string) — known data-quality issue, not a bug to "fix" blindly since Google's DOM/classnames change frequently and any selector here is inherently brittle.
- `POST /api/designs` is a **single synchronous request** that calls the Claude API and then launches a Playwright browser to render the result — it can take anywhere from a few seconds to ~20-30s depending on Claude's response time. There is no background job/queue; if this starts timing out under nginx-proxy's default proxy timeouts, the fix is a proper async job (create-and-poll, like the old Canva autofill pattern), not a shorter timeout.
- Design quality depends entirely on the system prompt in `claudeDesignService.ts` (`buildSystemPrompt`) — Claude sometimes ignores the exact-pixel-size instruction or wraps the response in a markdown code fence despite being told not to (there's a regex fallback in `generateDesignHtml()` that strips ```html fences if present, but no fallback for a wrong canvas size).
- Claude cannot generate photorealistic images/illustrations — only layout, copy, and composition. `referenceImageUrl` is the only way to get an actual photo into a design; Claude is instructed to reference that exact URL in an `<img>`/`background-image`, so a broken or slow-loading URL will render with a missing image rather than fail the whole generation (Playwright's `waitUntil: "networkidle"` gives it a chance to load, bounded by the 20s `page.setContent` timeout).
- `Design.imageData` stores the full PNG in Postgres — fine at this tool's expected volume, but if generation volume grows significantly, moving to a file volume + static route (or object storage) should happen before the DB size becomes a backup/replication concern.
