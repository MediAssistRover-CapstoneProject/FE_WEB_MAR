import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
const page = await browser.newPage();
const requests = [];
let acceptLogin = false;
let rejectProfile = false;
let forcePasswordChange = false, rejectCurrentPassword = true, profileRequests = 0;
const passwordWrites = [];

try {
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/me')) {
      profileRequests++;
      if (rejectProfile) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Tài khoản chưa có quyền truy cập' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'admin', role: 'ADMIN' }) });
    }
    if (route.request().url().endsWith('/auth/change-password')) {
      passwordWrites.push(route.request().postDataJSON());
      if (rejectCurrentPassword) { rejectCurrentPassword = false; return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Mật khẩu hiện tại không đúng' }) }); }
      return route.fulfill({ status: 204 });
    }
    if (route.request().url().endsWith('/auth/login')) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [], totalElements: 0 }) });
  });
  await page.route('**/api/v1/auth/login', async route => {
    assert.ok(route.request().url().startsWith('https://bemar-production.up.railway.app/api/v1/auth/login'), 'FE should use the Railway backend');
    requests.push(route.request().postDataJSON());
    await new Promise(resolve => setTimeout(resolve, 150));
    if (acceptLogin) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'test-access', refreshToken: 'test-refresh', mustChangePassword: forcePasswordChange }) });
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

  rejectProfile = true;
  await page.goto('http://127.0.0.1:5173/login');
  await page.getByLabel('Tên đăng nhập').fill('admin');
  await page.getByLabel('Mật khẩu').fill('test-only-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('alert').getByText('Tài khoản chưa có quyền truy cập').waitFor();
  assert.ok(page.url().endsWith('/login'));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('mediassist-rover.session')), null);
  rejectProfile = false;

  forcePasswordChange = true;
  const beforeProfile = profileRequests;
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/change-password');
  assert.equal(profileRequests, beforeProfile, 'BE blocks /auth/me until password is changed');
  await page.goto('http://127.0.0.1:5173/admin');
  await page.waitForURL('**/change-password');
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('temporary-test-password');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-test-password');
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới', exact: true }).click();
  await page.getByText('Xác nhận mật khẩu mới chưa khớp.', { exact: true }).waitFor();
  assert.equal(passwordWrites.length, 0);
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('new-test-password');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới', exact: true }).click();
  await page.getByText('Mật khẩu hiện tại không đúng', { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => sessionStorage.getItem('mediassist-rover.session')));
  await page.getByRole('button', { name: 'Lưu mật khẩu mới', exact: true }).click();
  await page.waitForURL('**/login');
  await page.getByText('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('mediassist-rover.session')), null);
  assert.deepEqual(passwordWrites.at(-1), { currentPassword: 'temporary-test-password', newPassword: 'new-test-password' });
  forcePasswordChange = false;

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
