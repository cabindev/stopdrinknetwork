// app/farewell/layout.tsx — โหลดฟอนต์ "เสาชิงช้า" ของ กทม. (--font-sao) ให้ทั้งส่วนส่งด้วยใจ
// ใช้แบบเลือกเปิดรายหน้า: หน้าแรก/3D/ข้อตกลง/ป้าย ใส่คลาส `farewellFont` (styles.sao) ที่ <main>
// หน้าวางแผน + สรุปแผน = ฟอนต์ปกติของเว็บ (ผู้ใช้ขอ 3 ต.ค. 2026 — ฟอร์มกรอกข้อมูลอ่านง่ายกว่า)
// น้ำหนัก: หัวข้อ Bold · เนื้อความ Regular · ตัวเล็ก Light · เงื่อนไขการใช้ฟอนต์ดู fonts/README.md
import localFont from 'next/font/local';

const sao = localFont({
  src: [
    { path: './fonts/SaoChingcha-Light.otf', weight: '300', style: 'normal' },
    { path: './fonts/SaoChingcha-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/SaoChingcha-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sao',
  display: 'swap',
});

export default function FarewellLayout({ children }: { children: React.ReactNode }) {
  return <div className={sao.variable}>{children}</div>;
}
