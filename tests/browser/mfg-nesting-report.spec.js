import { test, expect } from "@playwright/test";

test.describe("Manufacturing & Blueprints — Page Boot & Nesting Report Regression", () => {
  test("clean page boot: index.html loads without syntax error or furniai-boot-error", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Boot guard must mark boot as successful
    await page.waitForFunction(() => window.__furniaiBootOk === true, null, { timeout: 15000 });

    // furniai-boot-error must NOT be in DOM
    const bootError = page.locator("#furniai-boot-error");
    await expect(bootError).toHaveCount(0);

    // No uncaught script errors
    expect(pageErrors).toEqual([]);
  });

  test("nesting report: open modal, inspect generated report, test print trigger and close", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/#/build/golden-parametric");
    await expect(page.locator("#view-builder")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(
      () => typeof Builder !== "undefined" && Builder.isParametric && Builder.parts?.[0],
      null,
      { timeout: 15000 }
    );

    // 1. Open Manufacturing dropdown
    const mfgBtn = page.locator("#btnMfgDropdown");
    await expect(mfgBtn).toBeVisible();
    await mfgBtn.click();

    const mfgMenu = page.locator("#mfgMenuDropdown");
    await expect(mfgMenu).toBeVisible();

    // 2. Click Nesting Report button
    const nestingBtn = page.locator("#btnShowNestingReport");
    await expect(nestingBtn).toBeVisible();
    await nestingBtn.click();

    // 3. Modal should appear with populated body
    const modal = page.locator("#nestingReportModal");
    await expect(modal).toBeVisible();

    const modalBody = page.locator("#nestingReportModalBody");
    await expect(modalBody).toBeVisible();
    const bodyHtml = await modalBody.innerHTML();
    expect(bodyHtml).toMatch(/Sheet Nesting &amp; Material Report|Manufacturing Preflight/i);
    expect(bodyHtml).toMatch(/Sheets Required|Material Yield|Cut Parts/i);

    // 4. Test print trigger without crashing window
    // Spy on window.open in page context
    await page.evaluate(() => {
      window.__printedDocs = [];
      window.open = function () {
        const fakeDoc = {
          html: "",
          write(str) { this.html += str; },
          close() {},
        };
        const fakeWin = {
          document: fakeDoc,
          print() { fakeWin.printed = true; },
        };
        window.__printedDocs.push(fakeWin);
        return fakeWin;
      };
    });

    const printBtn = modal.locator("button:has-text('Print Report')");
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    const printResult = await page.evaluate(() => {
      if (!window.__printedDocs?.length) return null;
      const win = window.__printedDocs[0];
      return {
        hasHtml: win.document.html.length > 0,
        containsBody: /Sheet Nesting/i.test(win.document.html),
        containsPrintScript: win.document.html.includes("window.print()"),
      };
    });

    expect(printResult).not.toBeNull();
    expect(printResult.hasHtml).toBe(true);
    expect(printResult.containsBody).toBe(true);
    expect(printResult.containsPrintScript).toBe(true);

    // 5. Close modal
    const closeBtn = modal.locator("button:has-text('Done')");
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(modal).not.toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
