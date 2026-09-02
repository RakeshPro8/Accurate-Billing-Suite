import { expect, test } from "@playwright/test";

const documentTypes = [
  { tab: "sale-tab", number: "INV-0042", label: "INVOICE" },
  { tab: "quotation-tab", number: "QUO-0010", label: "QUOTATION" },
] as const;

test.describe("receipt print preview browser matrix", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/print-preview-harness.html");
    await expect(page.getByTestId("print-status")).toHaveText("ready");
  });

  for (const documentType of documentTypes) {
    test(`keeps the ${documentType.label.toLowerCase()} receipt as the only thermal surface`, async ({ page }) => {
      await page.getByTestId(documentType.tab).click();
      await page.getByTestId("print-receipt").click();
      await page.emulateMedia({ media: "print" });

      await expect(page.getByTestId("print-status")).toHaveText("printing");
      await expect(page.locator("body")).toHaveClass(/receipt-mode/);
      await expect(page.locator("[data-testid=receipt-surface]")).toBeVisible();
      await expect(page.locator("[data-testid=receipt-surface]")).toContainText(documentType.number);
      await expect(page.locator("[data-testid=receipt-surface]")).toContainText("Walk-in Customer");
      await expect(page.locator("[data-testid=receipt-surface]")).toContainText(
        "Ultra-long OLED replacement display assembly",
      );
      await expect(page.locator("[data-testid=receipt-surface] svg")).toHaveCount(1);
      await expect(page.locator("[data-testid=receipt-surface]")).not.toContainText("Tax (0%)");

      const printState = await page.evaluate(() => {
        const visible = (selector: string) =>
          [...document.querySelectorAll<HTMLElement>(selector)].map((element) => ({
            display: getComputedStyle(element).display,
            visibility: getComputedStyle(element).visibility,
            position: getComputedStyle(element).position,
            overflow: getComputedStyle(element).overflow,
          }));
        return {
          receipt: visible("[data-testid=receipt-surface]"),
          a4: visible(".invoice-print-area"),
          shell: visible(".harness-toolbar"),
          pageSize: document.getElementById("mobilinq-thermal-print-style")?.textContent?.includes("80mm auto") ?? false,
        };
      });

      expect(printState.receipt).toEqual([
        { display: "block", visibility: "visible", position: "static", overflow: "visible" },
      ]);
      expect(printState.a4).toHaveLength(3);
      expect(printState.a4.every((surface) => surface.display === "none")).toBe(true);
      expect(printState.shell[0]).toMatchObject({ display: "none", visibility: "hidden" });
      expect(printState.pageSize).toBe(true);
    });
  }

  test("cleans up after completion and cancellation in every browser", async ({ page }) => {
    await page.getByTestId("print-receipt").click();
    await expect(page.locator("body")).toHaveClass(/receipt-mode/);
    await page.getByTestId("complete-print").click();
    await expect(page.getByTestId("print-status")).toHaveText("afterprint");
    await expect(page.locator("body")).not.toHaveClass(/receipt-mode/);
    await expect(page.locator("#mobilinq-thermal-print-style")).toHaveCount(0);
    await expect(page.getByTestId("receipt-surface")).not.toBeVisible();

    await page.getByTestId("print-receipt").click();
    await expect(page.getByTestId("print-status")).toHaveText("printing");
    await page.getByTestId("cancel-print").click();
    await expect(page.getByTestId("print-status")).toHaveText("cancelled");
    await expect(page.locator("body")).not.toHaveClass(/receipt-mode/);
    await expect(page.locator("#mobilinq-thermal-print-style")).toHaveCount(0);
  });

  test("cleans up when print media returns to screen", async ({ page }) => {
    await page.getByTestId("print-receipt").click();
    await expect(page.locator("body")).toHaveClass(/receipt-mode/);

    await page.emulateMedia({ media: "print" });
    await page.emulateMedia({ media: "screen" });
    await expect(page.getByTestId("print-status")).toHaveText("media-query");
    await expect(page.locator("body")).not.toHaveClass(/receipt-mode/);
    await expect(page.locator("#mobilinq-thermal-print-style")).toHaveCount(0);
  });

  test("keeps A4 invoice, quotation, and repair paths isolated from thermal mode", async ({ page }) => {
    const a4State = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".invoice-print-area")].map((element) => ({
        display: getComputedStyle(element).display,
        position: getComputedStyle(element).position,
        overflow: getComputedStyle(element).overflow,
        text: element.textContent ?? "",
      })),
    );

    expect(a4State).toHaveLength(3);
    expect(a4State.every((surface) => surface.display === "block")).toBe(true);
    expect(a4State.every((surface) => surface.position === "static")).toBe(true);
    expect(a4State.every((surface) => surface.overflow === "visible")).toBe(true);
    expect(a4State.map((surface) => surface.text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("A4 invoice"),
        expect.stringContaining("A4 quotation"),
        expect.stringContaining("A4 repair ticket"),
      ]),
    );

    await page.getByTestId("print-receipt").click();
    await page.emulateMedia({ media: "print" });
    const thermalA4State = await page.locator(".invoice-print-area").evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).display),
    );
    expect(thermalA4State).toEqual(["none", "none", "none"]);
  });
});