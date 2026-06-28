import { chromium } from "playwright";
import type { Page } from "playwright";
import type { ScrapedPlace } from "./googlePlacesService";

// How many businesses to open the detail panel for. Each one is a navigation,
// so this bounds the total run time (~1-2s per place).
const MAX_DETAILS = 20;

export async function scrapeGoogleMaps(zone: string, category: string): Promise<ScrapedPlace[]> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ locale: "es-ES" });
    await context.addCookies([
      { name: "CONSENT", value: "YES+", domain: ".google.com", path: "/" },
    ]);
    const page = await context.newPage();
    const query = `${category} en ${zone}`;
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await dismissConsentDialog(page);

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
      const name = await card
        .$eval(".fontHeadlineSmall", (el) => el.textContent?.trim())
        .catch(() => null);
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const ratingText = await card
        .$eval(".MW4etd", (el) => el.textContent?.trim())
        .catch(() => null);
      const url = await card
        .$eval('a[href*="/maps/place/"]', (el) => (el as HTMLAnchorElement).href)
        .catch(() => null);

      stubs.push({
        name,
        rating: ratingText ? parseFloat(ratingText.replace(",", ".")) : undefined,
        url: url || undefined,
      });
    }

    // Second pass: open each business' detail panel to read phone, website and
    // a clean address from Google Maps' stable `data-item-id` selectors.
    const places: ScrapedPlace[] = [];
    for (const stub of stubs.slice(0, MAX_DETAILS)) {
      const details = stub.url ? await fetchDetailPanel(page, stub.url) : null;
      places.push({
        name: stub.name,
        category,
        rating: stub.rating,
        address: details?.address,
        phone: details?.phone,
        website: details?.website,
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
async function fetchDetailPanel(
  page: Page,
  url: string
): Promise<{ phone?: string; website?: string; address?: string } | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("h1.DUwDvf", { timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(400);

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
  } catch {
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

async function autoScrollResults(page: Page, feedSelector: string) {
  for (let i = 0; i < 5; i++) {
    await page.evaluate((selector) => {
      const feed = document.querySelector(selector);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);
    await page.waitForTimeout(1200);
  }
}
