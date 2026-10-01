// QA: ช่อง "มีแบบสำรวจ" — ติ๊ก+แนบ 2 ชุด (กด + เพิ่ม) → หน้า detail → แก้ไข: ลบ 1 ชุด → เลิกติ๊ก = ลบที่เหลือ → ไฟล์เกิน 20MB ถูกเตือน
// รัน: SURVEY_PDF=/path/to/file.pdf node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script scripts/qa/survey.mjs
// ลบงานทดสอบถาวรเองตอนจบ (ถังขยะ → ลบถาวร)
const BASE = 'http://localhost:3000';
const PDF = process.env.SURVEY_PDF;
const PDF2 = process.env.SURVEY_PDF2 || PDF; // ชุดที่ 2 (ไม่ตั้ง = ใช้ไฟล์เดิมซ้ำ)
const BIG = process.env.SURVEY_BIG_PDF; // (ไม่บังคับ) ไฟล์ >20MB ไว้เช็คข้อความเตือน
const api = (page, path, init) =>
  page.evaluate(async ([p, i]) => { const r = await fetch(p, i); return { status: r.status, body: await r.json().catch(() => null) }; }, [path, init]);

export default async (page) => {
  const r = {};
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@test.sdn');
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 });

  await page.goto(`${BASE}/activity/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 20000 });
  await page.fill('#title', 'QA แบบสำรวจ');
  await page.selectOption('#categoryId', { index: 1 });
  await page.fill('#description', 'ทดสอบช่องแบบสำรวจ');
  await page.fill('#locationSearch', 'ต.บ้านโป่ง');
  await page.waitForSelector('[role=option]', { timeout: 15000 });
  await page.press('#locationSearch', 'Enter');
  await page.waitForSelector('[data-testid=location-card]', { timeout: 15000 });

  r.attachHiddenBeforeTick = (await page.locator('button[aria-label="แนบไฟล์แบบสำรวจ"]').count()) === 0;
  await page.getByText('มีแบบสำรวจ', { exact: true }).click();
  if (BIG) {
    await page.setInputFiles('[data-testid=survey-input]', BIG);
    r.bigWarnChip = await page.getByText(/เกิน 20MB/).first().isVisible();
    await page.click('button[type=submit]');
    r.bigBlocked = await page.getByText(/เกิน 20MB/).count() > 1 && /\/new$/.test(page.url());
    await page.locator('button[aria-label="ลบไฟล์"]').last().click();
  }
  await page.setInputFiles('[data-testid=survey-input]', PDF);
  r.addMoreLabel = await page.locator('button[aria-label="แนบไฟล์แบบสำรวจ"]').innerText();
  await page.setInputFiles('[data-testid=survey-input]', PDF2); // เทียบเท่ากด "+ เพิ่มแบบสำรวจ" แล้วเลือกไฟล์
  r.formRows = await page.locator('[data-testid=survey-list] > div').count();
  await page.screenshot({ path: '/tmp/sdn-qa/survey-form.png', fullPage: false });
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 30000 });
  const id = Number(page.url().split('/').pop());
  r.id = id;
  const sec = page.locator('section', { has: page.locator('h2', { hasText: 'แบบสำรวจ' }) });
  r.detailSurveySection = await sec.count();
  r.detailSurveyFiles = await sec.locator('a[href^="/api/files/"]').count();
  const href = await sec.locator('a[href^="/api/files/"]').first().getAttribute('href').catch(() => null);
  r.fileServes = href ? (await page.evaluate(async (h) => (await fetch(h)).status, href)) : null;
  r.notInDocs = (await page.locator('section', { has: page.locator('h2', { hasText: 'เอกสาร' }) }).count()) === 0;

  // แก้ไข: ค่าติ๊กเดิมต้องโหลดมา + ไฟล์เดิมขึ้น · เลิกติ๊กแล้วบันทึก = ไฟล์ถูกลบ
  await page.goto(`${BASE}/activity/${id}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 20000 });
  r.editPrefilled = await page.getByText('มีแบบสำรวจ', { exact: true }).locator('input').isChecked();
  r.editShowsOldFiles = await page.locator('[data-testid=survey-list] > div').count();
  // ลบชุดแรกชุดเดียว → บันทึก → เหลือ 1
  await page.locator('[data-testid=survey-list] button[aria-label="ลบไฟล์"]').first().click();
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 30000 });
  r.afterRemoveOne = await page.locator('section', { has: page.locator('h2', { hasText: 'แบบสำรวจ' }) }).locator('a[href^="/api/files/"]').count();
  await page.goto(`${BASE}/activity/${id}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('fieldset[disabled]'), { timeout: 20000 });
  await page.getByText('มีแบบสำรวจ', { exact: true }).click();
  r.untickWarning = await page.getByText(/ไฟล์แบบสำรวจเดิม 1 ไฟล์จะถูกลบ/).isVisible(); // เหลือ 1 จากขั้นก่อน
  await page.click('button[type=submit]');
  await page.waitForURL(/\/activity\/\d+$/, { timeout: 30000 });
  r.afterUntickSection = await page.locator('section', { has: page.locator('h2', { hasText: /^แบบสำรวจ/ }) }).count();
  r.auditSurvey = /แบบสำรวจ/.test(await page.locator('body').innerText());
  r.oldFileGone = href ? (await page.evaluate(async (h) => (await fetch(h, { cache: "no-store" })).status, href)) : null;
  r.dbSurveyRows = await page.evaluate(async (i) => (await (await fetch(`/api/activities/${i}`)).json()).activity?.attachments?.length ?? "n/a", id);

  // ล้าง: ถังขยะ → ลบถาวร
  r.trash = (await api(page, `/api/activities/${id}`, { method: 'DELETE' })).status;
  r.purge = (await api(page, `/api/admin/trash/${id}`, { method: 'DELETE' })).status;
  return r;
};
