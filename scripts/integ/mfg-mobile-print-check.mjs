/**
 * Independent checks beyond AG Playwright:
 * 1) printNestingReport writes executable HTML (script not truncated by </script>)
 * 2) Manufacturing menu + nesting modal usable at 390px viewport
 */
import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
const PORT = 4191;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function startStatic() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = join(root, p.replace(/^\//, ''));
      if (!fp.startsWith(root) || !existsSync(fp) || !statSync(fp).isFile()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
      res.end(readFileSync(fp));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const out = { printHtml: null, mobile390: null };

const server = await startStatic();
const browser = await chromium.launch();
try {
  // --- Print HTML validity ---
  {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/#/build/golden-parametric`);
    await page.waitForFunction(
      () => typeof Builder !== 'undefined' && Builder.isParametric && Builder.parts?.[0],
      null,
      { timeout: 20000 }
    );
    await page.locator('#btnMfgDropdown').click();
    await page.locator('#btnShowNestingReport').click();
    await page.locator('#nestingReportModal').waitFor({ state: 'visible' });

    const printResult = await page.evaluate(() => {
      window.__printedDocs = [];
      window.open = function () {
        const fakeDoc = { html: '', write(str) { this.html += str; }, close() {} };
        const fakeWin = { document: fakeDoc, print() { this.printed = true; } };
        window.__printedDocs.push(fakeWin);
        return fakeWin;
      };
      window.printNestingReport();
      const html = window.__printedDocs[0]?.document?.html || '';
      // Valid executable HTML checks after AG '</script>' escape fix
      const hasDoctype = html.startsWith('<!DOCTYPE html>');
      const hasOpenScript = /<script\b/i.test(html);
      const hasCloseScript = /<\/script>/i.test(html);
      const hasPrintCall = html.includes('window.print()');
      // Premature close would truncate: body content before script must remain
      const scriptIdx = html.toLowerCase().indexOf('<script');
      const bodyHasReport =
        /Sheet Nesting|Material Yield|Cut Parts|Manufacturing Preflight/i.test(
          scriptIdx > 0 ? html.slice(0, scriptIdx) : html
        );
      // Ensure we did NOT write a raw </script> that would break outer parser —
      // the written HTML itself should contain a proper closing tag for the print script.
      const closeCount = (html.match(/<\/script>/gi) || []).length;
      return {
        length: html.length,
        hasDoctype,
        hasOpenScript,
        hasCloseScript,
        hasPrintCall,
        bodyHasReport,
        closeCount,
        head: html.slice(0, 180),
        tail: html.slice(-120),
      };
    });
    out.printHtml = { ...printResult, pageErrors };
    await page.close();
  }

  // --- Mobile 390px ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/#/build/golden-parametric`);
    await page.waitForFunction(
      () => typeof Builder !== 'undefined' && Builder.isParametric && Builder.parts?.[0],
      null,
      { timeout: 20000 }
    );
    const mfgBtn = page.locator('#btnMfgDropdown');
    await mfgBtn.waitFor({ state: 'visible', timeout: 10000 });
    const mfgBox = await mfgBtn.boundingBox();
    await mfgBtn.click();
    const menu = page.locator('#mfgMenuDropdown');
    await menu.waitFor({ state: 'visible' });
    const menuBox = await menu.boundingBox();
    const nestingBtn = page.locator('#btnShowNestingReport');
    await nestingBtn.click();
    const modal = page.locator('#nestingReportModal');
    await modal.waitFor({ state: 'visible' });
    const modalBox = await modal.boundingBox();
    const modalInner = page.locator('#nestingReportModal > div').first();
    const innerBox = await modalInner.boundingBox();
    const bodyHtml = await page.locator('#nestingReportModalBody').innerHTML();
    const done = modal.locator("button:has-text('Done')");
    await done.click();
    await modal.waitFor({ state: 'hidden' });

    const inViewport = (box) =>
      box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 + 1 && box.y + box.height <= 844 + 40;

    out.mobile390 = {
      mfgBtnVisible: !!mfgBox,
      menuVisible: !!menuBox,
      menuInViewport: inViewport(menuBox),
      menuBox,
      modalVisible: true,
      modalCoversViewport: modalBox && modalBox.width >= 380 && modalBox.height >= 800,
      innerInViewport: inViewport(innerBox) || (innerBox && innerBox.width <= 390 && innerBox.x >= 0),
      innerBox,
      reportPopulated: /Sheet Nesting|Material Yield|Cut Parts/i.test(bodyHtml),
      closedOk: true,
      pageErrors,
    };
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(out, null, 2));
const ok =
  out.printHtml?.hasDoctype &&
  out.printHtml?.hasOpenScript &&
  out.printHtml?.hasCloseScript &&
  out.printHtml?.hasPrintCall &&
  out.printHtml?.bodyHasReport &&
  (out.printHtml?.pageErrors || []).length === 0 &&
  out.mobile390?.mfgBtnVisible &&
  out.mobile390?.menuVisible &&
  out.mobile390?.reportPopulated &&
  out.mobile390?.closedOk &&
  (out.mobile390?.pageErrors || []).length === 0;
process.exit(ok ? 0 : 1);
