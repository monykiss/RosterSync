import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const cliArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const baseUrl = cliArgs[0] || 'http://127.0.0.1:3000';
const outputDir = path.resolve(process.cwd(), 'output/playwright');

async function ensureOutputDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

async function capture(page, name) {
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: true,
  });
}

async function expectVisible(page, locator, message) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    await capture(page, 'failure');
    throw new Error(message);
  }
}

async function run() {
  await ensureOutputDir();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1024 },
  });

  try {
    await page.goto(`${baseUrl}/app`, { waitUntil: 'networkidle' });
    await expectVisible(
      page,
      page.getByText('Demo Mode'),
      'Dashboard did not render the demo mode card',
    );
    await expectVisible(
      page,
      page.getByText('Weekly Schedules'),
      'Dashboard did not render week cards',
    );
    await capture(page, 'dashboard');

    await page.getByText('Week of').first().click();
    await page.waitForLoadState('networkidle');
    await expectVisible(
      page,
      page.getByText(/DRAFT|PUBLISHED v/i),
      'Planner page did not show a schedule state badge',
    );
    await capture(page, 'planner');

    await page.goto(`${baseUrl}/app/covers`, { waitUntil: 'networkidle' });
    await expectVisible(
      page,
      page.getByText('Cover Marketplace'),
      'Covers page did not load',
    );
    await expectVisible(
      page,
      page.locator('[class*="grid"] >> text=/OPEN|OFFERED|ASSIGNED/'),
      'Covers page did not render any seeded opportunity state',
    );
    await capture(page, 'covers');

    await page.goto(`${baseUrl}/app/sync`, { waitUntil: 'networkidle' });
    await expectVisible(
      page,
      page.getByText('STUB MODE'),
      'Sync page did not render the STUB banner',
    );
    await expectVisible(
      page,
      page.locator('table tbody tr'),
      'Sync page did not render any sync job rows',
    );
    await capture(page, 'sync');

    await page.goto(`${baseUrl}/app/notifications`, { waitUntil: 'networkidle' });
    await expectVisible(
      page,
      page.getByText('Notifications'),
      'Notifications page did not load',
    );
    await expectVisible(
      page,
      page.locator('text=/Cover Opportunity Available|Cover Assigned|Schedule Published|Sync Failed/'),
      'Notifications page did not render seeded or runtime notification content',
    );
    await capture(page, 'notifications');

    console.log(`Demo smoke passed for ${baseUrl}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
