//app/components/auth/SignInForm.tsx
'use client'

import { useState, FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import GoogleSignInButton from "./GoogleSignInButton"
import { AuthLayout, OrDivider, Field, PasswordField, SubmitButton, Notice } from "./AuthLayout"

// NextAuth ส่ง ?error= กลับมาหน้านี้เมื่อ login ด้วย Google ไม่สำเร็จ (pages.signIn ใน authOptions)
const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล จึงเข้าสู่ระบบไม่ได้",
  OAuthCallback: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ โปรดลองอีกครั้ง",
  OAuthSignin: "เชื่อมต่อ Google ไม่สำเร็จ โปรดลองอีกครั้ง",
}

// รับเฉพาะ path ในเว็บเราเอง — กัน ?callbackUrl= พาออกไปเว็บอื่น (NextAuth ส่งมาเป็น URL เต็ม)
// ไม่ระบุ (หรือเป็นหน้าแรก) = ไปแผนที่รวมงาน ไม่ค้างที่ landing
function safeCallback(raw: string | null): string {
  if (!raw) return "/map"
  if (raw === "/") return "/map"
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw
  if (typeof window === "undefined") return "/map" // ตอน SSR ยังไม่รู้ origin — ค่านี้ไม่ได้ถูกเขียนลง DOM
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname === "/") return "/map"
    return url.pathname + url.search
  } catch {
    return "/map"
  }
}

export default function SignInForm() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error")
  const [error, setError] = useState<string | null>(
    errorCode && errorCode !== "CredentialsSignin"
      ? OAUTH_ERRORS[errorCode] ?? "เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง"
      : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const callbackUrl = safeCallback(searchParams.get("callbackUrl"))

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const data = new FormData(e.currentTarget)

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: String(data.get("email")),
        password: String(data.get("password")),
      })

      if (result?.error) {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
      } else {
        router.replace(callbackUrl)
        router.refresh()
      }
    } catch {
      setError("เกิดข้อผิดพลาด โปรดลองอีกครั้ง")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Stop Drink Network"
      title="เข้าสู่ระบบ"
      subtitle="เครือข่ายงดเหล้า — บันทึกและติดตามการดำเนินงาน"
      footer={
        <>
          ยังไม่มีบัญชี?{" "}
          <Link href="/auth/signup" className="text-gray-900 font-semibold hover:text-orange-600 transition-colors">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      <div className="space-y-7">
        <GoogleSignInButton callbackUrl={callbackUrl} />

        <OrDivider />

        <form onSubmit={handleSubmit} className="space-y-7">
          <Field label="อีเมล" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          <div>
            <PasswordField label="รหัสผ่าน" name="password" required autoComplete="current-password" placeholder="••••••" />
            <Link
              href="/auth/forgot-password"
              className="inline-block mt-2 text-[13px] font-semibold text-gray-400 hover:text-orange-600 transition-colors"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <SubmitButton loading={isLoading}>เข้าสู่ระบบ</SubmitButton>
        </form>
      </div>
    </AuthLayout>
  )
}
