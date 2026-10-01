// QA: ทีมงานร่วม + นโยบาย (ตาราง ActivityPolicy) + ถังขยะ — ครบวงจรในเบราว์เซอร์จริง
// เพิ่ม/แก้/ลบงานได้เฉพาะแอดมิน (1 ต.ค. 2026) — ทีมงานเห็นงานแต่แก้ไม่ได้ (403)
// รัน: node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script scripts/qa/team-policy-trash.mjs
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
const api = (page, path, init) =>
  page.evaluate(async ([p, i]) => { const r = await fetch(p, i); return { status: r.status, body: await r.json().catch(() => null) }; }, [path, init]);

export default async (page) => {
  const r = {};
  // ── A. แอดมินสร้างงาน + ทีม (สมหญิง) + นโยบายระดับตำบล (เพิ่มงานได้เฉพาะแอดมิน — ต.ค. 2026)
  await login(page, 'admin@test.sdn');
  await page.goto(`${BASE}/activity/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title', { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 20000 });
  await page.fill('#title', 'QA ทีม+นโยบาย+ถังขยะ');
  await page.selectOption('#categoryId', { index: 1 });
  await page.fill('#description', 'ทดสอบงานทีม นโยบาย และถังขยะ');
  await page.fill('#locationSearch', 'ต.บ้านโป่ง');
  await page.waitForSelector('[role=option]', { timeout: 15000 });
  await page.press('#locationSearch', 'Enter');
  await page.waitForSelector('[data-testid=location-card]', { timeout: 15000 });
  await page.fill('[data-testid=team-search]', 'สมหญิง');
  await page.waitForTimeout(300);
  await page.press('[data-testid=team-search]', 'Enter');
  r.A_teamChip = await page.locator('[data-testid=team-chips]').innerText();
  await page.check('input[aria-label="มีนโยบายระดับตำบล"]');
  await page.fill('input[placeholder^="ชื่อนโยบาย"]', 'QA ธรรมนูญตำบล');
  await page.fill('input[placeholder="ปี พ.ศ."]', '2567');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 25000 }).catch(() => {});
  const id = Number(page.url().split('/').pop());
  r.A_id = id;
  const body = await page.evaluate(() => document.body.innerText);
  r.A_detailShowsTeam = /ทีมงาน: สมหญิง/.test(body);
  r.A_detailShowsPolicy = /QA ธรรมนูญตำบล/.test(body) && /2567/.test(body);

  // ── B. แอดมินแก้ปีนโยบาย → ประวัติการแก้ไขบันทึก
  await page.goto(`${BASE}/activity/${id}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 20000 });
  r.B_policyPrefilled = await page.inputValue('input[placeholder^="ชื่อนโยบาย"]');
  await page.fill('input[placeholder="ปี พ.ศ."]', '2568');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 25000 }).catch(() => {});
  const body2 = await page.evaluate(() => document.body.innerText);
  r.B_yearUpdated = /2568/.test(body2);
  r.B_auditPolicy = /รายละเอียดนโยบาย/.test(body2);

  // ── C. สมหญิง (ทีม) เห็นใน "งานของฉัน" แต่แก้/ลบไม่ได้ · วิชัย (นอกทีม) ก็ไม่ได้
  await logout(page);
  await login(page, 'somying@test.sdn');
  await page.goto(`${BASE}/activity`, { waitUntil: 'domcontentloaded' });
  r.C_teamSeesInMyWorks = (await page.locator(`a[href="/activity/${id}"]`).count()) > 0;
  r.C_teamNoNewButton = (await page.locator('a[href="/activity/new"]').count()) === 0;
  await page.goto(`${BASE}/activity/${id}/edit`, { waitUntil: 'domcontentloaded' });
  r.C_teamEditRedirected = !page.url().endsWith('/edit');
  r.C_teamApiPatch = (await api(page, `/api/activities/${id}`, { method: 'PATCH', body: new URLSearchParams() })).status;
  r.C_teamApiDelete = (await api(page, `/api/activities/${id}`, { method: 'DELETE' })).status;
  await logout(page);
  await login(page, 'wichai@test.sdn');
  await page.goto(`${BASE}/activity/${id}/edit`, { waitUntil: 'domcontentloaded' });
  r.C_outsiderRedirected = !page.url().endsWith('/edit');
  r.C_outsiderApiDelete = (await api(page, `/api/activities/${id}`, { method: 'DELETE' })).status;

  // ── D. แอดมินลบ → ถังขยะ: หายจาก "งานของฉัน" ของคนในทีม + หน้า detail
  await logout(page);
  await login(page, 'admin@test.sdn');
  r.D_delete = await api(page, `/api/activities/${id}`, { method: 'DELETE' });
  await logout(page);
  await login(page, 'somying@test.sdn');
  await page.goto(`${BASE}/activity`, { waitUntil: 'domcontentloaded' });
  r.D_goneFromMyWorks = (await page.locator(`a[href="/activity/${id}"]`).count()) === 0;
  const res = await page.goto(`${BASE}/activity/${id}`, { waitUntil: 'domcontentloaded' });
  r.D_detail404 = res.status() === 404;

  // ── E. แอดมิน: ถังขยะ → กู้คืน → ลบซ้ำ → ลบถาวร
  await logout(page);
  await login(page, 'admin@test.sdn');
  await page.goto(`${BASE}/dashboard/setting/trash`, { waitUntil: 'networkidle' });
  r.E_inTrash = await page.locator('[data-testid=trash-row]', { hasText: 'QA ทีม+นโยบาย+ถังขยะ' }).count();
  await page.locator('[data-testid=trash-row]', { hasText: 'QA ทีม+นโยบาย+ถังขยะ' }).locator('button:has-text("กู้คืน")').click();
  await page.waitForTimeout(1500);
  const back = await page.goto(`${BASE}/activity/${id}`, { waitUntil: 'domcontentloaded' });
  r.E_restored = back.status() === 200 && /QA ธรรมนูญตำบล/.test(await page.evaluate(() => document.body.innerText));
  await api(page, `/api/activities/${id}`, { method: 'DELETE' });
  await page.goto(`${BASE}/dashboard/setting/trash`, { waitUntil: 'networkidle' });
  const row = page.locator('[data-testid=trash-row]', { hasText: 'QA ทีม+นโยบาย+ถังขยะ' });
  await row.locator('button[title^="ลบถาวร"]').click();
  await row.locator('button:has-text("ยืนยันลบถาวร")').click();
  await page.waitForTimeout(1500);
  r.E_purged = (await api(page, `/api/admin/trash/${id}`, { method: 'POST' })).status === 404;

  // ── F. หน้าอื่นยังเปิดได้ (ตรวจว่าตัวกรองถังขยะไม่ทำอะไรพัง)
  const pages = ['/map', '/dashboard', '/dashboard/activities', '/dashboard/people', '/dashboard/setting/categories', '/dashboard/setting/audit', '/profile', '/stories', '/stories/84'];
  r.F_pages = {};
  for (const p of pages) r.F_pages[p] = (await page.goto(BASE + p, { waitUntil: 'domcontentloaded' })).status();
  r.F_export = await page.evaluate(async () => { const x = await fetch('/api/activities/export'); return x.status + ' ' + x.headers.get('content-type'); });
  return r;
};
