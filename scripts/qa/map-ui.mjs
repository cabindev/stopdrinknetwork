// ทดสอบ layout ใหม่แบบ Google Maps: rail + sidebar หมวดหมู่ + ชิปสถานะ
const SHOT = '/tmp/sdn-qa';
const markerColors = () =>
  [...document.querySelectorAll('path.leaflet-interactive')]
    .filter((p) => (p.getAttribute('d') || '').includes('a'))
    .map((p) => p.getAttribute('fill'));

export default async function run(page, ui) {
  const out = {};
  await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'somchai@test.sdn');
  await page.fill('#password', '12345');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 25000 }).catch(() => {});

  await page.goto('http://localhost:3000/map', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('path.leaflet-interactive').length > 50, {
    timeout: 25000,
  });
  await page.waitForTimeout(1200);

  out['1_railButtons'] = await page.locator('nav button, nav a').count();
  out['2_sidebarOpenByDefault'] = await page.locator('text=คลิกเพื่อกรองแผนที่').isVisible();
  out['3_categoryRows'] = await page.locator('aside button:has(span.rounded-full)').count();
  out['4_searchBoxVisible'] = await page.locator('input[placeholder*="ค้นหางาน"]').isVisible();
  out['5_statusChips'] = await page.locator('button:has-text("กำลังดำเนินการ")').count();
  out['6_markersDefault'] = (await page.evaluate(markerColors)).length;

  // คลิกหมวดหมู่ใน sidebar → กรอง
  const civic = page.locator('aside button', { hasText: 'Civic Space' }).first();
  await civic.click();
  await page.waitForTimeout(900);
  const afterCat = await page.evaluate(markerColors);
  out['7_markersAfterCategory'] = afterCat.length;
  out['7_colorIsCivicYellow'] = [...new Set(afterCat)].every((c) => c === '#eab308');
  await civic.click(); // ยกเลิกกรอง
  await page.waitForTimeout(700);

  // ชิปสถานะ
  await page.locator('button:has-text("เสร็จสิ้น")').first().click();
  await page.waitForTimeout(900);
  out['8_markersAfterStatusChip'] = (await page.evaluate(markerColors)).length;
  await page.locator('button:has-text("ล้าง")').first().click().catch(() => {});
  await page.waitForTimeout(700);
  out['8_markersAfterClear'] = (await page.evaluate(markerColors)).length;

  // ปุ่มโหมดความหนาแน่นบน rail
  await page.locator('nav button', { hasText: 'ความหนาแน่น' }).first().click();
  await page.waitForTimeout(1000);
  out['9_heatSidebarShown'] = await page.locator('text=ตามจำนวนเจ้าหน้าที่').isVisible();
  out['9_markersHidden'] = (await page.evaluate(markerColors)).length === 0;
  await page.locator('nav button', { hasText: 'หมุด' }).first().click();
  await page.waitForTimeout(900);
  out['9_backToMarkers'] = (await page.evaluate(markerColors)).length > 0;

  // ปิด/เปิด sidebar → แผนที่ต้องขยายและไม่พัง
  const mapW1 = await page.evaluate(() => document.querySelector('.leaflet-container').clientWidth);
  await page.locator('nav button', { hasText: 'หมวดหมู่' }).first().click();
  await page.waitForTimeout(800);
  const mapW2 = await page.evaluate(() => document.querySelector('.leaflet-container').clientWidth);
  out['10_mapWidthGrew'] = mapW2 > mapW1;
  out['10_widths'] = [mapW1, mapW2];
  await page.locator('nav button', { hasText: 'หมวดหมู่' }).first().click();
  await page.waitForTimeout(800);

  // คลิกหมุด → panel
  await page.locator('path[fill="#ea580c"]').first().click({ force: true });
  await page.waitForTimeout(1400);
  const t = await page.evaluate(() => document.body.innerText);
  out['11_panelProvince'] = t.match(/จ\.([ก-๙]+)/)?.[1] ?? null;
  await page.screenshot({ path: `${SHOT}/g-desktop.png` });

  // มือถือ
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  out['12_railVisibleMobile'] = await page.locator('nav').first().isVisible();
  out['12_searchVisibleMobile'] = await page.locator('input[placeholder*="ค้นหางาน"]').isVisible();
  await page.screenshot({ path: `${SHOT}/g-mobile.png` });

  return out;
}
