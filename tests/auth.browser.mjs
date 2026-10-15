import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const page = await browser.newPage();
const requests = [];
let acceptLogin = false;

try {
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', role: 'ADMIN' }) });
    }
    if (route.request().url().endsWith('/auth/login')) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
  });
  await page.route('**/api/v1/auth/login', async route => {
    assert.ok(route.request().url().startsWith('http://localhost:8080/api/v1/auth/login'), 'FE should use the local backend');
    requests.push(route.request().postDataJSON());
    await new Promise(resolve => setTimeout(resolve, 150));
    if (acceptLogin) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'test-access', refreshToken: 'test-refresh' }) });
    }
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' }) });
  });

  await page.goto('http://127.0.0.1:5173/login');
  assert.equal(await page.getByLabel('Tên đăng nhập').count(), 1);
  assert.equal(await page.getByText('Quên mật khẩu?', { exact: true }).count(), 0);
  await page.getByLabel('Tên đăng nhập').fill('  admin  ');
  await page.getByLabel('Mật khẩu').fill('invalid-test-password');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  assert.ok(await page.getByRole('button', { name: 'Đang đăng nhập…' }).isDisabled());
  await page.locator('form').evaluate(form => form.requestSubmit());
  await page.getByRole('alert').getByText('Tên đăng nhập hoặc mật khẩu không đúng').waitFor();
  assert.equal(requests.length, 1, 'A second submit must not retry the same credentials');
  assert.equal(requests[0].username, 'admin');
  assert.equal(requests[0].password, 'invalid-test-password');
  assert.equal('email' in requests[0], false);

  acceptLogin = true;
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/admin');
  assert.equal(requests.length, 2);
  assert.ok(await page.evaluate(() => JSON.parse(sessionStorage.getItem('mediassist-rover.session')).tokens.accessToken === 'test-access'));

  await page.goto('http://127.0.0.1:5173/register');
  await page.getByText('Tài khoản MediAssistRover được quản trị viên cấp.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Tạo tài khoản' }).count(), 0);

  const demoPage = await browser.newPage();
  const demoRequests = [];
  await demoPage.route('**/api/v1/**', async route => {
    demoRequests.push(route.request().url());
    return route.abort();
  });
  await demoPage.goto('http://127.0.0.1:5173/login');
  await demoPage.getByLabel('Tên đăng nhập').fill('demo');
  await demoPage.getByLabel('Mật khẩu').fill('demo123');
  assert.equal(await demoPage.getByLabel('Tên đăng nhập').inputValue(), 'demo');
  await demoPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await demoPage.waitForURL('**/admin');
  assert.equal(await demoPage.getByText('Chế độ demo · không kết nối BE').count(), 0);
  assert.equal(await demoPage.evaluate(() => JSON.parse(sessionStorage.getItem('mediassist-rover.session')).mode), 'demo');
  await demoPage.waitForTimeout(200);
  assert.deepEqual(demoRequests, [], 'Demo mode must not call the backend');
  await demoPage.locator('.logout-button').click();
  await demoPage.waitForURL('http://127.0.0.1:5173/');
  assert.deepEqual(demoRequests, [], 'Demo logout must not call the backend');
  console.log('PASS: API login handles 401/success; demo login and logout never call the backend.');
} finally {
  await browser.close();
}
