// app/farewell/layout.tsx — ฟอนต์ "เสาชิงช้า" ของ กทม. ทั้งส่วนส่งด้วยใจ (ผู้ใช้เลือก 2 ต.ค. 2026 แทน Kanit/FC Vision)
// น้ำหนักตามลำดับชั้น: หัวข้อ Bold · เนื้อความ Regular · ตัวเล็ก/หมายเหตุ Light (styles.sao)
// Navbar อยู่ใน root layout จึงยังใช้ฟอนต์ระบบเหมือนส่วนอื่นของเว็บ · เงื่อนไขการใช้ฟอนต์ดู fonts/README.md
import localFont from 'next/font/local';
import styles from './farewell.module.css';

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
  return <div className={`${sao.variable} ${styles.sao}`}>{children}</div>;
}
