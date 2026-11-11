import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { navigationGroups } from '../src/features/admin/navigation.js';
import { pathForScreen, screenForSlug } from '../src/features/admin/screenRoutes.js';
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
const apiCalls=[];
await page.route('**/api/v1/**', route => { apiCalls.push(new URL(route.request().url()).pathname);return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0 }) }); });

try {
  const screens = navigationGroups.flatMap(([, items]) => items);
  assert.equal(new Set(screens).size, screens.length, 'Mỗi màn hình chỉ xuất hiện một lần trong cấu trúc menu');
  assert.equal(screens.includes('Crowd Heatmap'),false);
  assert.equal(screens.includes('Missions'), false);
  assert.equal(screens.includes('Workflow Management'), false);
  for (const screen of screens) {
    const path = pathForScreen(screen);
    if (path.startsWith('/admin/')) assert.equal(screenForSlug(path.slice('/admin/'.length)), screen, `Route must retain the sidebar screen: ${screen}`);
  }
  assert.equal(pathForScreen('Public Catalog'), '/admin/facility');
  assert.equal(screenForSlug('public-catalog'), 'Facility Management');
  assert.equal(screenForSlug('missions'), null);
  assert.equal(screenForSlug('workflow-catalog'), null);
  assert.equal(pathForScreen('Workflow Management'), '/workflow');

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

  const mapGroup = menu.getByRole('button', { name: vi('Map & Navigation'), exact: true });
  const hospitalItem = menu.getByRole('button', { name: 'Thông tin bệnh viện', exact: true });
  await mapGroup.click();
  await hospitalItem.click();
  await page.waitForURL('**/admin/facility');
  await page.getByRole('heading', { name: 'Thông tin bệnh viện', exact: true, level: 2 }).waitFor();
  assert.equal(await mapGroup.getAttribute('aria-expanded'), 'true');
  assert.equal(await hospitalItem.getAttribute('aria-current'), 'page');
  assert.equal(await menu.getByRole('button', { name: vi('Overview') }).getAttribute('aria-expanded'), 'false');
  await page.reload();
  await hospitalItem.waitFor();
  assert.equal(await mapGroup.getAttribute('aria-expanded'), 'true');
  assert.equal(await hospitalItem.getAttribute('aria-current'), 'page');
  await page.screenshot({ path: '.workstation-build/sidebar-facility.png' });

  await menu.getByRole('button', { name: vi('Automation') }).click();
  await menu.getByRole('button', { name: 'Thiết kế quy trình' }).waitFor();
  assert.equal(await menu.getByRole('button', { name: 'Danh mục quy trình', exact: true }).count(), 0);
  await menu.getByRole('button', { name: 'Thiết kế quy trình' }).click();
  await page.waitForURL(/\/workflow(s)?$/);
  await page.locator('.wfd-page').waitFor();
  const workflowSidebar = page.locator('aside.mediassist-sidebar');
  await workflowSidebar.waitFor({ state: 'visible' });
  await workflowSidebar.getByRole('button', { name: vi('Automation') }).waitFor();
  assert.equal(Math.round((await workflowSidebar.boundingBox()).width), 248);
  assert.equal(await workflowSidebar.getByRole('button', { name: vi('Automation') }).getAttribute('aria-expanded'), 'true');
  assert.equal(await workflowSidebar.getByRole('button', { name: vi('Automation') }).evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(245, 248, 254)');
  await page.screenshot({ path: '.workstation-build/sidebar-workflows.png' });
  for (const oldPath of ['/admin/workflow-catalog', '/admin?screen=Workflow%20Management', '/admin/workflow-catalog?tab=published']) {
    await page.goto(base + oldPath);
    await page.waitForURL('**/workflow');
    await page.locator('.wfd-page').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Danh mục quy trình', exact: true }).count(), 0);
  }
  await page.goto(base+'/admin/crowd-heatmap');
  await page.getByRole('heading',{name:'Bảng điều khiển',exact:true,level:1}).waitFor();
  await page.goto(base+'/admin?screen=Crowd%20Heatmap');
  await page.getByRole('heading',{name:'Bảng điều khiển',exact:true,level:1}).waitFor();
  assert.ok(!apiCalls.some(path=>/monitoring\/(crowd-density|heatmaps)/.test(path)));

  for (const oldPath of ['/admin/missions', '/admin?screen=Missions', '/admin/missions?tab=deliveries']) {
    await page.goto(base + oldPath);
    await page.waitForURL('**/admin/live-operations');
    await page.locator('.lo-page').waitFor();
    assert.equal(await menu.getByRole('button', { name: 'Nhiệm vụ', exact: true }).count(), 0);
    assert.equal(await page.locator('a[href*="/admin/missions"]').count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Nhiệm vụ & yêu cầu', exact: true }).count(), 0);
  }

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
  await page.goto(base + '/admin/missions');
  await page.waitForURL('**/admin/live-operations');
  await page.getByRole('button', { name: 'Mở menu' }).click();
  assert.equal(await menu.getByRole('button', { name: 'Nhiệm vụ', exact: true }).count(), 0);
  for (const oldPath of ['/admin/workflow-catalog', '/admin?screen=Workflow%20Management', '/workflow']) {
    await page.goto(base + oldPath);
    await page.waitForURL('**/admin/live-operations');
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await menu.getByRole('button', { name: vi('Automation'), exact: true }).click();
    assert.equal(await menu.getByRole('button', { name: 'Thiết kế quy trình', exact: true }).count(), 0);
    assert.equal(await menu.getByRole('button', { name: 'Danh mục quy trình', exact: true }).count(), 0);
  }
  console.log('PASS: sidebar navigation and mobile, one workflow designer entry, removed catalog redirects, role-safe workflow access.');
} finally {
  await browser.close();
}
