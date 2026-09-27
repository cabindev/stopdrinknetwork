//app/components/auth/ForgotPasswordForm.tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { AuthLayout, Field, SubmitButton, Notice } from './AuthLayout';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || 'ลิงก์รีเซ็ตรหัสผ่านถูกส่งไปยังอีเมลของคุณแล้ว');
        setIsSuccess(true);
        setEmail('');
      } else {
        setMessage(data.error || 'เกิดข้อผิดพลาดในการส่งอีเมล');
        setIsSuccess(false);
      }
    } catch (error) {
      console.error('Error occurred:', error);
      setMessage('เกิดข้อผิดพลาดในการส่งอีเมล');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Stop Drink Network"
      title="ลืมรหัสผ่าน"
      subtitle="กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"
      footer={
        <Link href="/auth/signin" className="text-gray-900 font-semibold hover:text-orange-600 transition-colors">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-7">
        <Field
          label="อีเมล"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {message && <Notice tone={isSuccess ? "success" : "danger"}>{message}</Notice>}

        <SubmitButton loading={isLoading}>ส่งลิงก์รีเซ็ตรหัสผ่าน</SubmitButton>
      </form>
    </AuthLayout>
  );
}
