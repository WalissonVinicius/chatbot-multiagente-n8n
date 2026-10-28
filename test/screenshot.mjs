// Temporário: tira o print do workflow no editor do n8n para o README.
import { chromium } from "playwright";

const N8N = "http://localhost:5678";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2200, height: 1250 }, deviceScaleFactor: 2 });

const setup = await page.request.post(`${N8N}/rest/owner/setup`, {
  data: { email: "demo@exemplo.com", firstName: "Demo", lastName: "Exemplo", password: "Demo12345678" },
});
console.log("owner setup:", setup.status());

await page.goto(`${N8N}/workflow/chatbotMultiAg01`);
await page.waitForSelector(".vue-flow__node", { timeout: 90_000 });
await page.waitForTimeout(3000);
for (let i = 0; i < 3; i++) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}
await page.locator(".vue-flow__pane").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press("1");
await page.waitForTimeout(2000);

await page.screenshot({ path: "docs/page.png" });
await page.locator(".vue-flow").first().screenshot({ path: "docs/workflow.png" });
await browser.close();
