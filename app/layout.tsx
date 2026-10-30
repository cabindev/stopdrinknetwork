// app/layout.tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import SessionProvider from "./components/SessionProvider";
import { Toaster } from "react-hot-toast";
import { getServerSession } from "next-auth/next";
import authOptions from "./lib/configs/auth/authOptions";
import Navbar from "@/components/Navbar";

// ฟอนต์หลักทั้งเว็บ = IBM Plex Sans Thai (ผู้ใช้ขอ 30 ต.ค. 2026 — มีทั้งไทยและละติน, OFL)
// next/font ดาวน์โหลดไฟล์ตอน build แล้วเสิร์ฟจากเว็บเราเอง · หน้าที่ใช้เสาชิงช้า (คลาส .sao ใน farewell) ยังใช้เสาชิงช้าตามเดิม
const ibm = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm",
  display: "swap",
});

export const metadata: Metadata = {
  // ให้ og:image ของหน้ากรณีศึกษาเป็น URL เต็ม (Facebook/LINE ต้องการ) — ใช้โดเมนจาก NEXTAUTH_URL
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "Stop Drink Network",
  description: "เครือข่ายงดเหล้า | ร่วมสร้างสังคมปลอดเหล้า เพื่อสุขภาพที่ดีของทุกคน",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="th" className={ibm.variable} suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          <Navbar />
          {children}
          <Toaster position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
