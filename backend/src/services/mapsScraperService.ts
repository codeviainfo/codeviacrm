// patchright is a drop-in, stealth-patched build of Playwright (the same
// engine Scrapling's StealthyFetcher uses): it removes the automation leaks
// (Runtime.enable, navigator.webdriver, console hooks...) Google uses to flag
// headless browsers. patchright@1.48.2 ships the same Chromium revision (1140)
// as playwright@1.48.0, so it reuses the browser baked into the Docker image.
import { chromium } from "patchright";
import type { ElementHandle, LaunchOptions, Page } from "patchright";
import type { ScrapedPlace } from "./googlePlacesService";

// How many businesses to open the detail panel for. Each one is a navigation,
// so this bounds the total run time (~1-2s per place). 60 mirrors the hard cap
// of the Google Places API path (3 pages x 20) for consistent results between
// both search methods.
const MAX_DETAILS = 60;

// Resource types that are useless for text extraction. Blocking them cuts
// memory and time per page a lot, which matters in a 320 MB container.
const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);
// Map tiles are requested as XHR/fetch, so they need a URL match instead.
const BLOCKED_URL_PATTERN = /\/maps\/vt|\/vt\?|khms\d*\.google|\/kh\/v=|streetviewpixels/;

// Thrown when Google serves its "unusual traffic" page or a CAPTCHA instead of
// results. Carries whatever was scraped before the block so it isn't lost.
export class GoogleBlockedError extends Error {
  constructor(public partial: ScrapedPlace[] = []) {
    super("Google ha bloqueado temporalmente la búsqueda desde esta IP (CAPTCHA). Prueba más tarde o configura un proxy.");
    this.name = "GoogleBlockedError";
  }
}

// Only one Chromium at a time: two concurrent scrapes would each launch a
// browser and push the container over its memory limit. Later calls wait.
let queue: Promise<unknown> = Promise.resolve();

export function scrapeGoogleMaps(zone: string, category: string): Promise<ScrapedPlace[]> {
  const run = queue.then(() => runScrape(zone, category));
  queue = run.catch(() => undefined);
  return run;
}

async function runScrape(zone: string, category: string): Promise<ScrapedPlace[]> {
  const browser = await chromium.launch({ headless: true, proxy: pickProxy() });

  try {
    const context = await browser.newContext({
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      viewport: { width: 1366, height: 768 },
    });
    await context.addCookies([
      { name: "CONSENT", value: "YES+", domain: ".google.com", path: "/" },
    ]);
    await context.route("**/*", (route) => {
      const request = route.request();
      if (BLOCKED_RESOURCE_TYPES.has(request.resourceType()) || BLOCKED_URL_PATTERN.test(request.url())) {
        return route.abort();
      }
      return route.continue();
    });

    const page = await context.newPage();
    const query = `${category} en ${zone}`;
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await dismissConsentDialog(page);
    await assertNotBlocked(page);

    const resultsFeedSelector = 'div[role="feed"]';
    await page.waitForSelector(resultsFeedSelector, { timeout: 15000 }).catch(() => null);

    await autoScrollResults(page, resultsFeedSelector);

    // First pass: collect each result's name, rating and detail URL from the
    // list cards. The phone almost never appears on the list card itself —
    // it only lives in the per-business detail panel — so we capture the URLs
    // here and open each one below.
    const cards = await page.$$('div[role="feed"] > div > div[jsaction]');
    const stubs: Array<{ name: string; rating?: number; url?: string }> = [];
    const seen = new Set<string>();

    for (const card of cards) {
      // The place link's aria-label is the business name and is far more
      // stable than Google's obfuscated class names, which stay as fallback.
      const name = await firstText(card, [
        { selector: 'a[href*="/maps/place/"]', attr: "aria-label" },
        { selector: ".fontHeadlineSmall" },
      ]);
      if (!name || seen.has(name)) continue;
      seen.add(name);

      // e.g. aria-label="4,5 estrellas 128 reseñas" — the first number is the rating.
      const ratingText = await firstText(card, [
        { selector: 'span[role="img"][aria-label*="estrella"]', attr: "aria-label" },
        { selector: 'span[role="img"][aria-label*="star"]', attr: "aria-label" },
        { selector: ".MW4etd" },
      ]);
      const url = await card
        .$eval('a[href*="/maps/place/"]', (el) => (el as HTMLAnchorElement).href)
        .catch(() => null);

      stubs.push({
        name,
        rating: parseRating(ratingText),
        url: url || undefined,
      });
    }

    // Second pass: open each business' detail panel to read phone, website and
    // a clean address from Google Maps' stable `data-item-id` selectors.
    const places: ScrapedPlace[] = [];
    for (const stub of stubs.slice(0, MAX_DETAILS)) {
      let details: Awaited<ReturnType<typeof fetchDetailPanel>> = null;
      if (stub.url) {
        try {
          details = await fetchDetailPanel(page, stub.url);
        } catch (err) {
          if (err instanceof GoogleBlockedError) throw new GoogleBlockedError(places);
          throw err;
        }
      }
      // Place URLs embed the coordinates as "!3d<lat>!4d<lng>".
      const coords = stub.url?.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      places.push({
        name: stub.name,
        category,
        rating: stub.rating,
        address: details?.address,
        phone: details?.phone,
        website: details?.website,
        latitude: coords ? parseFloat(coords[1]) : undefined,
        longitude: coords ? parseFloat(coords[2]) : undefined,
        googleMapsUrl: stub.url,
      });
    }

    return places;
  } finally {
    await browser.close();
  }
}

// Opens a Google Maps place URL and extracts phone/website/address from the
// detail panel. Everything is best-effort and guarded — Google's DOM changes
// often — but `data-item-id` attributes have been stable for years and carry
// the phone number directly (e.g. data-item-id="phone:tel:+34 600 123 456").
// Retries once on a navigation timeout; a Google block is rethrown.
async function fetchDetailPanel(
  page: Page,
  url: string,
  attempt = 1
): Promise<{ phone?: string; website?: string; address?: string } | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await assertNotBlocked(page);
    await page.waitForSelector('h1, button[data-item-id]', { timeout: 8000 }).catch(() => null);
    await humanDelay(400);

    const phone = await page
      .$eval('button[data-item-id^="phone:tel:"]', (el) =>
        (el.getAttribute("data-item-id") || "").replace("phone:tel:", "").trim()
      )
      .catch(() => null);

    const website = await page
      .$eval('a[data-item-id="authority"]', (el) => (el as HTMLAnchorElement).href)
      .catch(() => null);

    const address = await page
      .$eval('button[data-item-id="address"]', (el) =>
        (el.getAttribute("aria-label") || "")
          .replace(/^Dirección:\s*/i, "")
          .replace(/^Address:\s*/i, "")
          .trim()
      )
      .catch(() => null);

    return {
      phone: phone || undefined,
      website: website || undefined,
      address: address || undefined,
    };
  } catch (err) {
    if (err instanceof GoogleBlockedError) throw err;
    if (attempt < 2) {
      await humanDelay(1500);
      return fetchDetailPanel(page, url, attempt + 1);
    }
    return null;
  }
}

async function dismissConsentDialog(page: Page) {
  const acceptSelectors = [
    'button:has-text("Aceptar todo")',
    'button:has-text("Accept all")',
    'form[action*="consent"] button',
  ];
  for (const selector of acceptSelectors) {
    const button = await page.$(selector).catch(() => null);
    if (button) {
      await button.click().catch(() => null);
      await page.waitForTimeout(1000);
      return;
    }
  }
}

// Google answers abusive traffic with a redirect to /sorry/ (the "unusual
// traffic" page) or an inline reCAPTCHA. Without this check the scraper just
// finds no results feed and silently returns 0 places.
async function assertNotBlocked(page: Page) {
  if (page.url().includes("/sorry/")) throw new GoogleBlockedError();
  const captcha = await page
    .$('form#captcha-form, iframe[src*="recaptcha"], div.g-recaptcha')
    .catch(() => null);
  if (captcha) throw new GoogleBlockedError();
}

// Scrolls the results feed until it stops growing (Google Maps lazy-loads
// more cards as you approach the bottom) or we hit the iteration cap. Two
// consecutive scrolls with no height change means we've reached the end of
// the list (or Google's own ~120-result cap for a single search).
async function autoScrollResults(page: Page, feedSelector: string) {
  let lastHeight = 0;
  let stableRounds = 0;

  for (let i = 0; i < 15 && stableRounds < 2; i++) {
    const height = await page.evaluate((selector) => {
      const feed = document.querySelector(selector);
      if (!feed) return 0;
      feed.scrollTop = feed.scrollHeight;
      return feed.scrollHeight;
    }, feedSelector);

    await humanDelay(1200);

    stableRounds = height === lastHeight ? stableRounds + 1 : 0;
    lastHeight = height;
  }
}

// Tries each selector in order and returns the first non-empty text (or
// attribute). Lightweight take on Scrapling's "adaptive" selectors: a stable
// selector first, Google's obfuscated classes as fallback.
async function firstText(
  root: ElementHandle,
  candidates: Array<{ selector: string; attr?: string }>
): Promise<string | null> {
  for (const { selector, attr } of candidates) {
    const value = await root
      .$eval(
        selector,
        (el, attrName) => (attrName ? el.getAttribute(attrName) : el.textContent)?.trim() || null,
        attr ?? null
      )
      .catch(() => null);
    if (value) return value;
  }
  return null;
}

function parseRating(text: string | null): number | undefined {
  const match = text?.match(/\d+(?:[.,]\d+)?/);
  if (!match) return undefined;
  const rating = parseFloat(match[0].replace(",", "."));
  return rating >= 0 && rating <= 5 ? rating : undefined;
}

// Fixed waits make a very regular, bot-like request pattern; jitter them ±40%.
function humanDelay(baseMs: number) {
  const ms = baseMs * (0.6 + Math.random() * 0.8);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SCRAPER_PROXY_URLS: optional comma-separated list, e.g.
// "http://user:pass@host:port,http://host2:port". One is picked at random per
// run, so Google sees the searches spread over several IPs.
function pickProxy(): LaunchOptions["proxy"] {
  const urls = (process.env.SCRAPER_PROXY_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length === 0) return undefined;

  const parsed = new URL(urls[Math.floor(Math.random() * urls.length)]);
  return {
    server: `${parsed.protocol}//${parsed.host}`,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  };
}
