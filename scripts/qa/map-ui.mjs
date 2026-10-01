// QA: หน้าแผนที่ (layout ปัจจุบัน ต.ค. 2026) — แถบไอคอนซ้าย, แผงตัวกรอง, โหมดความหนาแน่น, popup หมุด, มือถือ
// + โหมดสาธารณะ (ไม่ login): ไม่มีชื่อเจ้าหน้าที่/ปุ่มนำทาง/เกณฑ์จำนวนเจ้าหน้าที่
// รัน: node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script scripts/qa/map-ui.mjs
// หมุด = circleMarker (<path> ที่มีคำสั่ง arc) + หมุดโลโก้ (.sdn-logo-pin) — ดูกับดักข้อ 3 ใน CLAUDE.md
const SHOT = '/tmp/sdn-qa';
const BASE = 'http://localhost:3000';
const pinCount = () =>
  [...document.querySelectorAll('path.leaflet-interactive')].filter((p) => /a/i.test(p.getAttribute('d') || '')).length +
  document.querySelectorAll('.sdn-logo-pin').length;

async function openMap(page) {
  await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(pinCount, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
async function firstPopupText(page) {
  await page.locator('.sdn-logo-pin, path.leaflet-interactive[d*="a"]').first().click({ force: true });
  await page.waitForSelector('.leaflet-popup-content', { timeout: 5000 }).catch(() => {});
  return (await page.locator('.leaflet-popup-content').last().innerText().catch(() => '')).replace(/\s+/g, ' ');
}

export default async function run(page) {
  const out = {};
  await page.setViewportSize({ width: 1280, height: 860 });

  // ── A. ทีมงาน (member ที่อนุมัติแล้ว) — ข้อมูลเต็ม
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'somchai@test.sdn');
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 }).catch(() => {});
  await openMap(page);
  out.A1_pins = await page.evaluate(pinCount);
  out.A2_searchBox = await page.locator('input[placeholder*="ค้นหางาน"]').isVisible();
  const popup = await firstPopupText(page);
  out.A3_popupHasAuthor = /โดย /.test(popup);
  out.A3_popupHasDetailLink = /ดูรายละเอียดเต็ม/.test(popup);
  await page.keyboard.press('Escape');

  // แผงตัวกรอง: เปิดจากแถบไอคอน → กรองประเด็นแรกที่มีงาน → หมุดลด/เท่า → ยกเลิก
  await page.locator('button[title^="ตัวกรอง"]').click();
  await page.waitForTimeout(500);
  out.A4_filterPanel = await page.locator('h2', { hasText: 'ตัวกรอง' }).isVisible();
  const cat = page.locator('aside button', { has: page.locator('span.rounded-full') }).first();
  const catName = (await cat.innerText()).split('\n')[0];
  await cat.click();
  await page.waitForTimeout(900);
  out.A5_filterCategory = { name: catName, pins: await page.evaluate(pinCount) };
  await cat.click();
  await page.waitForTimeout(700);
  await page.locator('aside button', { hasText: 'เสร็จสิ้น' }).first().click();
  await page.waitForTimeout(900);
  out.A6_pinsCompleted = await page.evaluate(pinCount);
  await page.locator('aside button', { hasText: 'ทั้งหมด' }).first().click();
  await page.waitForTimeout(700);
  out.A6_pinsAllAgain = (await page.evaluate(pinCount)) === out.A1_pins;

  // โหมดความหนาแน่น (แผงตัวกรองเปิดอยู่ → เห็นเกณฑ์)
  await page.locator('button[title="ดูความหนาแน่น"]').click();
  await page.waitForTimeout(1000);
  out.A7_heatStaffMetric = await page.locator('text=ตามจำนวนเจ้าหน้าที่').isVisible();
  out.A7_heatPinsHidden = (await page.evaluate(pinCount)) === 0;
  await page.locator('button[title="ดูหมุด"]').click();
  await page.waitForTimeout(900);
  out.A7_backToPins = (await page.evaluate(pinCount)) > 0;
  await page.screenshot({ path: `${SHOT}/map-desktop.png` });

  // มือถือ
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  out.A8_mobile = {
    rail: await page.locator('nav').first().isVisible(),
    search: await page.locator('input[placeholder*="ค้นหางาน"]').isVisible(),
    noHScroll: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  };
  await page.screenshot({ path: `${SHOT}/map-mobile.png` });

  // ── B. สาธารณะ (ไม่ login) — ข้อมูลถูกกรอง
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.context().clearCookies();
  await openMap(page);
  out.B1_pins = await page.evaluate(pinCount);
  out.B2_noStaffNamesInPayload = !/"userName\\?":\\?"[^"\\]/.test(await page.content());
  const pub = await firstPopupText(page);
  out.B3_popupNoAuthor = !/โดย /.test(pub);
  out.B3_popupNoNav = !/นำทาง/.test(pub);
  out.B3_popupStoryOrNote = /อ่านกรณีศึกษา|ยังไม่มีกรณีศึกษา/.test(pub);
  await page.keyboard.press('Escape');
  out.B4_noExcelButton = (await page.locator('a[href^="/api/activities/export"]').count()) === 0;
  await page.locator('button[title^="ตัวกรอง"]').click();
  await page.locator('button[title="ดูความหนาแน่น"]').click();
  await page.waitForTimeout(800);
  out.B5_noStaffMetric = !(await page.locator('text=ตามจำนวนเจ้าหน้าที่').isVisible());
  return out;
}
