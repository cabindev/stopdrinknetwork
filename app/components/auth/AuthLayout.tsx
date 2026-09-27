// app/components/auth/AuthLayout.tsx
// เปลือกหน้า auth (แนวเดียวกับ activerun) — ไม่มีการ์ด พื้นขาวล้วน หัวเรื่องใหญ่ ช่องกรอกแบบเส้นใต้
// Navbar ลอยอยู่ด้านบนอยู่แล้ว จึงเว้น pt-20 และไม่ต้องมีโลโก้ซ้ำ
'use client'

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col pt-20">
      <main className="flex-1 flex items-center px-5 sm:px-8 pb-16">
        <div className="w-full max-w-md mx-auto animate-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-600">{eyebrow}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mt-2">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
          <div className="mt-9">{children}</div>
          {footer && <div className="mt-10 text-sm text-gray-500">{footer}</div>}
          <Link href="/" className="inline-block mt-6 text-[13px] text-gray-400 hover:text-gray-700 transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>
      </main>
    </div>
  )
}

/** เส้นคั่น "หรือ" ระหว่างปุ่ม Google กับฟอร์มอีเมล */
export function OrDivider({ label = "หรือใช้อีเมล" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-[13px] text-gray-400">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

export const inputClass =
  "w-full h-11 bg-transparent border-b border-gray-300 text-[15px] text-gray-900 placeholder:text-gray-400 " +
  "focus:outline-none focus:border-orange-600 transition-colors"

const labelClass = "text-[13px] font-semibold text-gray-500" // ไม่ใส่ letter-spacing — ทำให้อักษรไทยแยกห่าง

type InputProps = { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>

/** ช่องกรอกแบบเส้นใต้ — ไม่มีกล่อง ไม่มีไอคอน */
export function Field({ label, name, className, ...props }: InputProps) {
  return (
    <div className={className}>
      <label htmlFor={props.id ?? name} className={cn(labelClass, "block mb-1")}>
        {label}
        {props.required && <span className="text-orange-600 ml-1">*</span>}
      </label>
      <input id={name} name={name} className={inputClass} {...props} />
    </div>
  )
}

/** ช่องรหัสผ่าน — ปุ่มสลับเป็นตัวอักษร แสดง/ซ่อน */
export function PasswordField({ label, name, className, ...props }: InputProps) {
  const [show, setShow] = useState(false)
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1">
        <label htmlFor={props.id ?? name} className={labelClass}>
          {label}
          {props.required && <span className="text-orange-600 ml-1">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setShow(!show)}
          className={cn(labelClass, "text-gray-400 hover:text-gray-900 transition-colors")}
        >
          {show ? "ซ่อน" : "แสดง"}
        </button>
      </div>
      <input id={name} name={name} type={show ? "text" : "password"} className={inputClass} {...props} />
    </div>
  )
}

/** ปุ่มหลัก — แคปซูลส้มพื้นล้วน */
export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-12 rounded-full bg-orange-600 text-white text-[15px] font-semibold hover:bg-orange-700 transition-colors disabled:bg-orange-300 disabled:cursor-not-allowed inline-flex items-center justify-center"
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

export function Spinner() {
  return (
    <span className="inline-flex gap-1" role="status" aria-label="กำลังโหลด">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  )
}

export function Notice({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "text-sm rounded-xl px-4 py-3 border",
        tone === "danger" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
      )}
    >
      {children}
    </p>
  )
}
