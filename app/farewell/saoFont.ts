// app/farewell/saoFont.ts — ฟอนต์ "เสาชิงช้า" ของ กทม. (--font-sao) ใช้ร่วม: layout ของ /farewell + หน้าแรก / (กระดานจัดงาน)
// น้ำหนัก: หัวข้อ Bold · เนื้อความ Regular · ตัวเล็ก Light · เงื่อนไขการใช้ฟอนต์ดู fonts/README.md
import localFont from 'next/font/local';

export const sao = localFont({
  src: [
    { path: './fonts/SaoChingcha-Light.otf', weight: '300', style: 'normal' },
    { path: './fonts/SaoChingcha-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/SaoChingcha-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sao',
  display: 'swap',
});
