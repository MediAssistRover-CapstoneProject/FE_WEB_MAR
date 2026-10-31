import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { navigationGroups } from '../src/features/admin/navigation.js';
import { vi } from '../src/i18n/vi.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { if (!sessionStorage.getItem('mediassist-rover.session')) sessionStorage.setItem('mediassist-rover.session', JSON.stringify({
  account: { username: 'admin', role: 'ADMIN' }, tokens: { accessToken: 'sidebar-test' },
})); });
const page = await context.newPage();
const base=process.env.TEST_URL||'http://127.0.0.1:5175';
await page.route('**/api/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0 }) }));

try {
  const screens = navigationGroups.flatMap(([, items]) => items);
  assert.equal(new Set(screens).size, screens.length, 'Mỗi màn hình chỉ xuất hiện một lần trong cấu trúc menu');

  await page.goto(base+'/admin');
  const sidebar = page.locator('aside.sidebar');
  const menu = sidebar.getByRole('navigation', { name: 'Điều hướng quản trị' });
  await menu.getByRole('button', { name: vi('Overview') }).waitFor();
  assert.equal(await menu.getByRole('button', { name: vi('Overview') }).getAttribute('aria-expanded'), 'true');
  assert.equal(await menu.getByRole('button', { name: vi('Operations') }).getAttribute('aria-expanded'), 'false');
  assert.equal(await sidebar.getByRole('button', { name: 'Tài khoản của tôi' }).count(), 1);
  assert.equal(await sidebar.getByRole('button', { name: vi('Log out') }).count(), 1);
  await mkdir('.workstation-build', { recursive: true });
  await page.screenshot({ path: '.workstation-build/sidebar-desktop.png' });

  await menu.getByRole('button', { name: vi('Automation') }).click();
  await menu.getByRole('button', { name: 'Thiết kế quy trình' }).waitFor();
  await menu.getByRole('button', { name: 'Danh mục quy trình' }).click();
  await page.waitForURL('**/admin/workflow-catalog');
  assert.equal(await menu.getByRole('button', { name: vi('Automation') }).getAttribute('aria-expanded'), 'true');
  await menu.getByRole('button', { name: 'Thiết kế quy trình' }).click();
  await page.waitForURL(/\/workflow(s)?$/);
  const workflowSidebar = page.locator('aside.mediassist-sidebar');
  await workflowSidebar.getByRole('button', { name: vi('Automation') }).waitFor();
  assert.equal(Math.round((await workflowSidebar.boundingBox()).width), 248);
  assert.equal(await workflowSidebar.getByRole('button', { name: vi('Automation') }).getAttribute('aria-expanded'), 'true');
  assert.equal(await workflowSidebar.getByRole('button', { name: vi('Automation') }).evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(245, 248, 254)');
  await page.screenshot({ path: '.workstation-build/sidebar-workflows.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base+'/admin');
  await page.getByRole('button', { name: 'Mở menu' }).click();
  assert.equal(await sidebar.isVisible(), true);
  await page.waitForTimeout(250);
  assert.ok((await sidebar.boundingBox()).x >= 0, 'Menu mobile phải nằm trong khung nhìn');
  await page.screenshot({ path: '.workstation-build/sidebar-mobile.png' });
  await page.keyboard.press('Escape');
  assert.equal(await sidebar.isVisible(), false);
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await sidebar.getByRole('button', { name: 'Tài khoản của tôi' }).click();
  await page.waitForURL('**/admin/my-account');
  assert.equal(await sidebar.isVisible(), false);
  await page.evaluate(() => localStorage.setItem('mediassist-rover.session', JSON.stringify({ account: { username: 'staff', role: 'STAFF' }, tokens: { accessToken: 'sidebar-test' } })));
  await page.goto(base+'/admin');
  await page.getByRole('button', { name: 'Mở menu' }).click();
  assert.equal(await menu.getByRole('button', { name: vi('Administration') }).count(), 0);
  assert.equal(await sidebar.getByRole('button', { name: 'Tài khoản của tôi' }).count(), 1);
  console.log('PASS: sidebar gọn, đủ màn hình, hai loại quy trình rõ ràng và mở được trên mobile.');
} finally {
  await browser.close();
}
