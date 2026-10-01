// QA: พรีวิวรูปเต็มจอ (ImageGallery) — เปิด/เลื่อน/วนรอบ/รูปย่อ/Esc/คลิกพื้นหลัง/ล็อกการเลื่อนหน้า
// รัน: node ~/.claude/skills/browser-automation/browser.mjs http://localhost:3000/ --script scripts/qa/lightbox.mjs
const BASE = 'http://localhost:3000';
const ID = 85; // งานที่มีรูป 5 รูป (ข้อมูลนำเข้างานศพ)
export default async (page) => {
  const r = {};
  await page.goto(`${BASE}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@test.sdn');
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`${BASE}/activity/${ID}`, { waitUntil: 'networkidle' });
  const counter = () => page.locator('[data-testid=lightbox-counter]').innerText();
  r.thumbs = await page.locator('[data-testid=image-gallery] button').count();
  await page.locator('[data-testid=image-gallery] button').nth(1).click();
  await page.waitForSelector('[data-testid=lightbox]');
  r.openAt2 = await counter();
  r.scrollLocked = await page.evaluate(() => document.body.style.overflow === 'hidden');
  await page.waitForFunction(() => { const i = document.querySelector('[data-testid=lightbox-image]'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
  r.imageLoaded = true;
  await page.screenshot({ path: '/tmp/sdn-qa/lightbox.png' }).catch(() => {});
  await page.click('button[aria-label="รูปถัดไป"]');
  r.afterNext = await counter();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  r.wrapToFirst = await counter();
  await page.keyboard.press('ArrowLeft');
  r.wrapToLast = await counter();
  await page.click('button[aria-label="ไปรูปที่ 3"]');
  r.thumbJump = await counter();
  await page.keyboard.press('Escape');
  r.closedByEsc = (await page.locator('[data-testid=lightbox]').count()) === 0;
  r.scrollRestored = await page.evaluate(() => document.body.style.overflow !== 'hidden');
  await page.locator('[data-testid=image-gallery] button').first().click();
  await page.mouse.click(20, 400); // พื้นหลังด้านซ้าย (นอกรูป/ปุ่ม)
  r.closedByBackdrop = (await page.locator('[data-testid=lightbox]').count()) === 0;
  return r;
};
