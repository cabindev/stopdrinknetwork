// ทดสอบระบบรอบใหญ่ — ครอบคลุมสิทธิ์, ฟอร์ม, ไฟล์แนบ, แก้ไข/ลบ, audit, แผนที่, แดชบอร์ดแอดมิน
const SHOT = '/tmp/sdn-qa';
const BASE = 'http://localhost:3000';

async function login(page, email) {
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 }).catch(() => {});
  return !page.url().includes('signin');
}
async function logout(page) {
  await page.goto(`${BASE}/api/auth/signout`, { waitUntil: 'domcontentloaded' });
  await page.locator('button[type=submit]').click().catch(() => {});
  await page.waitForTimeout(800);
}

export default async function run(page) {
  const r = {};

  // ── A. ผู้ใช้ที่ยังไม่ล็อกอิน
  const guarded = ['/activity', '/activity/new', '/map', '/profile', '/dashboard'];
  r.A_guardedRedirects = {};
  for (const path of guarded) {
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    r.A_guardedRedirects[path] = page.url().includes('signin') ? 'redirect→signin' : `เข้าได้! (${res.status()})`;
  }

  // ── B. member: บันทึกงานใหม่ครบทุกช่อง
  r.B_login = await login(page, 'somchai@test.sdn');
  await page.goto(`${BASE}/activity/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title', { timeout: 15000 });
  await page.fill('#title', 'QA ทดสอบระบบรอบใหญ่');
  await page.selectOption('#categoryId', { index: 1 });
  await page.fill('#description', 'ทดสอบ end-to-end ผ่านเบราว์เซอร์จริง');
  // เลือกพื้นที่จาก LocationField: พิมพ์ชื่อตำบล → Enter เลือกรายการแรก → การ์ดสรุปพื้นที่ + ช่องชื่อสถานที่
  await page.fill('#locationSearch', 'ต.บ้านโป่ง');
  await page.waitForSelector('[role=option]', { timeout: 15000 });
  r.B_tambonOptions = await page.locator('[role=option]').count();
  await page.press('#locationSearch', 'Enter');
  await page.waitForSelector('[data-testid=location-card]', { timeout: 15000 });
  r.B_areaAutoFilled = await page.locator('[data-testid=location-card]:has-text("ภาค")').isVisible();
  await page.fill('#areaName', 'ชุมชนทดสอบ QA');
  // ThaiDateField เป็นปฏิทินป๊อปอัป (ไม่ใช่ input) → เปิดแล้วกด "วันนี้"
  await page.click('#startDate');
  await page.locator('button:has-text("วันนี้")').first().click();
  // แนบไฟล์
  // ใช้ data-testid — input ไฟล์นโยบายก็รับ .pdf/รูป selector ตาม accept จะชนกัน
  await page.setInputFiles('[data-testid=image-input]', `${SHOT}/test.png`);
  await page.waitForTimeout(1200);
  await page.setInputFiles('[data-testid=doc-input]', `${SHOT}/test.pdf`);
  await page.waitForTimeout(600);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 25000 }).catch(() => {});
  r.B_redirectedToDetail = /\/activity\/\d+$/.test(page.url());
  r.B_newActivityUrl = page.url();
  const newId = Number(page.url().split('/').pop());

  // ── C. หน้ารายละเอียด: ไฟล์แนบเปิดได้ + ประวัติ
  const body = await page.evaluate(() => document.body.innerText);
  r.C_showsImageSection = /รูปภาพกิจกรรม/.test(body);
  r.C_showsDocSection = /เอกสาร\/นโยบาย/.test(body);
  r.C_showsHistory = /ประวัติการแก้ไข/.test(body);
  const imgOk = await page.evaluate(() => {
    const img = document.querySelector('section img');
    return img ? img.naturalWidth > 0 : null;
  });
  r.C_imageLoads = imgOk;

  // ── D. แก้ไขงาน → ต้องมี audit diff
  await page.goto(`${BASE}/activity/${newId}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title', { timeout: 15000 });
  await page.fill('#title', 'QA ทดสอบระบบรอบใหญ่ (แก้ไข)');
  await page.selectOption('#status', 'COMPLETED');
  await page.click('#endDate');
  await page.locator('button:has-text("วันนี้")').first().click();
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  const body2 = await page.evaluate(() => document.body.innerText);
  r.D_historyHasEdit = /แก้ไขรายการนี้/.test(body2);
  r.D_historyShowsStatusDiff = /สถานะ/.test(body2) && /เสร็จสิ้น/.test(body2);

  // ── E. สิทธิ์: คนอื่นแก้ไม่ได้
  await logout(page);
  await login(page, 'somying@test.sdn');
  const editRes = await page.goto(`${BASE}/activity/${newId}/edit`, { waitUntil: 'domcontentloaded' });
  r.E_otherUserRedirected = !page.url().includes('/edit');
  r.E_status = editRes.status();
  await page.goto(`${BASE}/activity/${newId}`, { waitUntil: 'domcontentloaded' });
  const body3 = await page.evaluate(() => document.body.innerText);
  r.E_otherUserSeesNoEditButton = !/แก้ไข\b/.test(body3.split('ประวัติการแก้ไข')[0]);

  // ── F. แดชบอร์ดแอดมิน
  await logout(page);
  await login(page, 'admin@test.sdn');
  const pages = {
    dashboard: '/dashboard',
    users: '/dashboard/setting/admin',
    categories: '/dashboard/setting/categories',
    audit: '/dashboard/setting/audit',
  };
  r.F_adminPages = {};
  for (const [k, path] of Object.entries(pages)) {
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const txt = await page.evaluate(() => document.body.innerText);
    r.F_adminPages[k] = { status: res.status(), chars: txt.length, hasError: /error|Error/.test(txt) };
  }
  const auditTxt = await page.evaluate(() => document.body.innerText);
  r.F_auditHasEntries = /QA ทดสอบระบบรอบใหญ่/.test(auditTxt);
  await page.screenshot({ path: `${SHOT}/f-audit.png` });

  // ── G. member เข้า dashboard ไม่ได้
  await logout(page);
  await login(page, 'wichai@test.sdn');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  r.G_memberBlockedFromDashboard = page.url().includes('signin') || !page.url().includes('/dashboard');

  // ── H. ลบงานทดสอบ (เจ้าของ)
  await logout(page);
  await login(page, 'somchai@test.sdn');
  await page.goto(`${BASE}/activity/${newId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('button:has-text("ลบงานนี้")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("ยืนยันลบ")').click();
  await page.waitForURL(/\/activity$/, { timeout: 20000 }).catch(() => {});
  r.H_deletedRedirect = /\/activity$/.test(page.url());

  return r;
}
