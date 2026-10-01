// QA: แนบลิงก์ภายนอก — ฟอร์ม → รายละเอียด → แก้ไข/audit → เผยแพร่ (Drive ไม่ติ๊กตั้งต้น) → หน้าสาธารณะ → API กันลิงก์อันตราย
// รัน: node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script scripts/qa/links.mjs
// เพิ่ม/แก้งานได้เฉพาะแอดมิน (ต.ค. 2026) · ลบงานทดสอบถาวรเองตอนจบ
const BASE = 'http://localhost:3000';
async function login(page, email) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 }).catch(() => {});
}
async function logout(page) {
  await page.goto(`${BASE}/api/auth/signout`, { waitUntil: 'domcontentloaded' });
  await page.locator('button[type=submit]').click().catch(() => {});
  await page.waitForTimeout(800);
}
async function addLink(page, url, title = '') {
  await page.fill('[data-testid=link-url]', url);
  if (title) await page.fill('[data-testid=link-title]', title);
  await page.click('[data-testid=link-add]');
  await page.waitForTimeout(200);
}
export default async (page) => {
  const r = {};
  await login(page, 'admin@test.sdn');
  await page.goto(`${BASE}/activity/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 30000 });
  await page.fill('#title', 'QA ลิงก์ภายนอก');
  await page.selectOption('#categoryId', { index: 1 });
  await page.fill('#description', 'ทดสอบแนบลิงก์');
  await page.fill('#locationSearch', 'ต.บ้านโป่ง');
  await page.waitForSelector('[role=option]', { timeout: 15000 });
  await page.press('#locationSearch', 'Enter');
  await page.waitForSelector('[data-testid=location-card]', { timeout: 15000 });
  await addLink(page, 'https://www.facebook.com/civicspace/posts/1', 'โพสต์เพจ');
  await addLink(page, 'youtu.be/abc123');
  await addLink(page, 'https://drive.google.com/file/d/xyz/view', 'รายงานฉบับเต็ม');
  await addLink(page, 'javascript:alert(1)');
  r.A_rejectedMsg = await page.locator('[data-testid=links-field] [role=alert]').innerText().catch(() => null);
  await page.fill('[data-testid=link-url]', '');
  r.A_listCount = await page.locator('[data-testid=link-list] li').count();
  r.A_driveHint = await page.locator('[data-testid=links-field]').innerText().then((t) => t.includes('ทุกคนที่มีลิงก์'));
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 25000 }).catch(() => {});
  const id = Number(page.url().split('/').pop());
  r.id = id;
  r.B_detailLinks = await page.locator('[data-testid=activity-links] li').allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, ' ')));
  r.B_hrefs = await page.$$eval('[data-testid=activity-links] a', (as) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));

  // แก้ไข: ลบลิงก์ YouTube + ตั้งชื่อ
  await page.goto(`${BASE}/activity/${id}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 30000 });
  r.C_prefilled = await page.locator('[data-testid=link-list] li').count();
  await page.locator('[data-testid=link-list] li', { hasText: 'youtu.be' }).locator('button[aria-label="ลบลิงก์"]').click();
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 25000 }).catch(() => {});
  const body = await page.evaluate(() => document.body.innerText);
  r.C_afterEdit = await page.locator('[data-testid=activity-links] li').count();
  r.C_auditHasLinks = /ลิงก์ที่เกี่ยวข้อง/.test(body.split('ประวัติการแก้ไข')[1] || '');

  // API ตรง: ลิงก์อันตรายต้องถูกปฏิเสธ
  r.D_apiReject = await page.evaluate(async (id) => {
    const fd = new FormData();
    fd.set('links', JSON.stringify([{ url: 'javascript:alert(1)' }]));
    const res = await fetch(`/api/activities/${id}`, { method: 'PATCH', body: fd });
    return res.status;
  }, id);

  // แอดมินเผยแพร่: Drive ต้องไม่ติ๊กตั้งต้น
  await logout(page);
  await login(page, 'admin@test.sdn');
  await page.goto(`${BASE}/activity/${id}/publish`, { waitUntil: 'networkidle' });
  r.E_publishChecks = await page.$$eval('[data-testid=publish-links] input[type=checkbox]', (cs) => cs.map((c) => [c.getAttribute('aria-label'), c.checked]));
  await page.click('button:has-text("เผยแพร่เป็นกรณีศึกษา")');
  await page.waitForURL(/\/stories\/\d+$/, { timeout: 25000 }).catch(() => {});
  await logout(page);
  const res = await page.goto(`${BASE}/stories/${id}`, { waitUntil: 'domcontentloaded' });
  r.F_guestStatus = res.status();
  r.F_publicLinks = await page.locator('[data-testid=activity-links] li').allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, ' ')));

  // ล้าง: ถังขยะ → ลบถาวร
  await login(page, 'admin@test.sdn');
  r.Z_cleanup = await page.evaluate(async (i) => [
    (await fetch(`/api/activities/${i}`, { method: 'DELETE' })).status,
    (await fetch(`/api/admin/trash/${i}`, { method: 'DELETE' })).status,
  ], id);
  return r;
};
