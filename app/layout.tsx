// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "./components/SessionProvider";
import { Toaster } from "react-hot-toast";
import { getServerSession } from "next-auth/next";
import authOptions from "./lib/configs/auth/authOptions";
import Navbar from "@/components/Navbar";

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
    <html lang="th" suppressHydrationWarning>
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
