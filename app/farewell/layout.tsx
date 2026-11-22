// app/farewell/layout.tsx — โหลดฟอนต์ "เสาชิงช้า" ของ กทม. (--font-sao) ให้ทั้งส่วนส่งด้วยใจ (นิยามฟอนต์ที่ saoFont.ts)
// ใช้แบบเลือกเปิดรายหน้า: หน้าแรก/3D/ข้อตกลง/ป้าย ใส่คลาส `farewellFont` (styles.sao) ที่ <main>
// หน้าวางแผน + สรุปแผน = ฟอนต์ปกติของเว็บ (ผู้ใช้ขอ 3 ต.ค. 2026 — ฟอร์มกรอกข้อมูลอ่านง่ายกว่า)
import { sao } from './saoFont';

export default function FarewellLayout({ children }: { children: React.ReactNode }) {
  return <div className={sao.variable}>{children}</div>;
}
