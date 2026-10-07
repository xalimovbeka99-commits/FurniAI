/**
 * Capture screenshots of all redesigned surfaces in desktop & 390px mobile viewports:
 * 1. Home (Landing)
 * 2. Catalog (Gallery with filter chips)
 * 3. Studio - "Build to my sizes"
 * 4. Studio - "Create from a reference" with Scenario-style visual concepts
 * 5. My Designs (Empty state & Populated state)
 * 6. Auth Modal & Factory Order Modal
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = path.resolve('docs/artifacts/customer-redesign');

test.describe('FurniAI Customer Redesign Screenshot Suite', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test('Capture Desktop & Mobile Redesign Surfaces', async ({ page }) => {
    test.setTimeout(60000);
    // 1. Desktop Home / Landing Surface
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:4173/#/');
    await page.waitForSelector('#view-landing:not([hidden])');
    await page.waitForTimeout(1000); // Wait for canvas / hero init
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01-desktop-home.png'), fullPage: false });

    // 2. Desktop Catalog Surface
    await page.evaluate(() => {
      const g = document.getElementById('gallery');
      if (g) g.scrollIntoView();
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02-desktop-catalog.png'), fullPage: false });

    // 3. Desktop Studio - "Build to my sizes"
    await page.goto('http://127.0.0.1:4173/#/build/ai-wardrobe');
    await page.waitForSelector('#view-builder:not([hidden])');
    await page.waitForSelector('#aiWardrobeInput');
    await page.fill('#aiWardrobeInput', '1800mm wide wardrobe with smoked glass doors and warm interior lighting');
    await page.click('#aiWardrobeSubmitBtn');
    await page.waitForSelector('#aiWardrobeReviewSection:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03-desktop-studio-sizes.png'), fullPage: false });

    // 4. Desktop Studio - "Create from a reference"
    await page.click('#btnModeRef');
    await page.waitForSelector('#referenceCreationPanel', { state: 'visible' });
    await page.click('#btnGenerateConcepts');
    await page.waitForSelector('.concept-card', { timeout: 5000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04-desktop-studio-reference.png'), fullPage: false });

    // 5. My Designs - Populated State
    await page.evaluate(() => {
      localStorage.setItem('furniai_saved_designs', JSON.stringify([
        {
          id: 'design_ref_901',
          designId: 'design_ref_901',
          name: 'Master Dressing Suite',
          revision: 2,
          config: { type: 'wardrobe', w: 260, h: 250, d: 62, mat: 'walnut' }
        },
        {
          id: 'design_ref_902',
          designId: 'design_ref_902',
          name: 'Minimal Basalt Unit',
          revision: 1,
          config: { type: 'wardrobe', w: 240, h: 240, d: 60, mat: 'dark_oak' }
        }
      ]));
    });
    await page.goto('http://127.0.0.1:4173/#/projects');
    await page.waitForSelector('.project-card');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05-desktop-my-designs-populated.png'), fullPage: false });

    // 6. My Designs - Empty State
    await page.evaluate(async () => {
      localStorage.removeItem('furniai_saved_designs');
      if (typeof window.loadProjects === 'function') {
        await window.loadProjects();
      }
    });
    await page.waitForSelector('.projects-empty');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06-desktop-my-designs-empty.png'), fullPage: false });

    // 7. Modals - Auth Modal
    await page.goto('http://127.0.0.1:4173/#/build/ai-wardrobe');
    await page.evaluate(() => window.openAuthModal());
    await page.waitForSelector('#authModal:not([hidden])');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '07-desktop-auth-modal.png'), fullPage: false });
    await page.evaluate(() => window.closeAuthModal());

    // 8. Mobile 390px Viewport - Home
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4173/#/');
    await page.waitForSelector('#view-landing:not([hidden])');
    await page.waitForTimeout(800);
    const hasHorizontalOverflowHome = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflowHome).toBe(false);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '08-mobile-390px-home.png'), fullPage: false });

    // 9. Mobile 390px Viewport - Studio
    await page.goto('http://127.0.0.1:4173/#/build/ai-wardrobe');
    await page.waitForSelector('#view-builder:not([hidden])');
    await page.waitForTimeout(800);
    const hasHorizontalOverflowStudio = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflowStudio).toBe(false);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '09-mobile-390px-studio.png'), fullPage: false });

    // 10. Mobile 390px Viewport - Reference Concepts
    await page.click('#btnModeRef');
    await page.waitForSelector('#referenceCreationPanel', { state: 'visible' });
    await page.click('#btnGenerateConcepts');
    await page.waitForSelector('.concept-card', { timeout: 5000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '10-mobile-390px-studio-reference.png'), fullPage: false });
  });
});
