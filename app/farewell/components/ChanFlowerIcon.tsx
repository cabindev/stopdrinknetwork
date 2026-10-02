// app/farewell/components/ChanFlowerIcon.tsx — ไอคอน "ดอกไม้จันทน์" ของ ส่งด้วยใจ (แทน Flower2 ของ lucide)
// วาดเองแบบเส้นตามสไตล์ lucide: stroke = currentColor ใช้ className กำหนดสี/ขนาดได้เหมือนไอคอนอื่น
// 6 กลีบปลายแหลม (เติมพื้นขาว กลีบหลังซ้อนกลีบหน้าเหมือนดอกจริง) + เกสรกลาง + ก้านไม้ 1 ก้านเฉียงด้านหลัง
// (ลองก้านคู่รูปตัว V และกลีบ 5 แฉกแล้ว — ย่อเล็กดูเป็นดาวห้าแฉกมีเขา ห้ามกลับไปใช้)
import type { SVGProps } from 'react';

export default function ChanFlowerIcon({ strokeWidth = 1.75, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M11.5 13 21 2.5" />
      <path d="M11.50 13.00Q16.78 10.29 13.65 4.98Q8.28 8.01 11.50 13.00ZM11.50 13.00Q16.49 16.22 19.52 10.85Q14.21 7.72 11.50 13.00ZM11.50 13.00Q11.21 18.93 17.37 18.87Q17.43 12.71 11.50 13.00ZM11.50 13.00Q6.22 15.71 9.35 21.02Q14.72 17.99 11.50 13.00ZM11.50 13.00Q6.51 9.78 3.48 15.15Q8.79 18.28 11.50 13.00ZM11.50 13.00Q11.79 7.07 5.63 7.13Q5.57 13.29 11.50 13.00Z" fill="#fff" />
      <circle cx="11.5" cy="13" r="2.9" fill="#fff" />
      <circle cx="11.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
