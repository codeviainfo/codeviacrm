import { chromium } from "playwright";

export async function renderHtmlToPng(html: string, width: number, height: number): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html, { waitUntil: "networkidle", timeout: 20000 });
    return await page.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }
}
