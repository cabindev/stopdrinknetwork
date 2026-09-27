//app/components/auth/ResetPasswordForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout, PasswordField, SubmitButton, Notice } from './AuthLayout';

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null | undefined>(undefined); // undefined = ยังไม่ได้อ่าน URL
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    setToken(urlToken);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (password.length < 5) {
      setMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 5 ตัวอักษร');
      setIsSuccess(false);
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('รหัสผ่านไม่ตรงกัน');
      setIsSuccess(false);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน');
      }

      setMessage('รีเซ็ตรหัสผ่านสำเร็จ กำลังไปหน้าเข้าสู่ระบบ...');
      setIsSuccess(true);
      setTimeout(() => router.push('/auth/signin'), 2000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Stop Drink Network"
      title="ตั้งรหัสผ่านใหม่"
      subtitle="กำหนดรหัสผ่านใหม่ของคุณ อย่างน้อย 5 ตัวอักษร"
      footer={
        <Link href="/auth/signin" className="text-gray-900 font-semibold hover:text-orange-600 transition-colors">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-7">
        <PasswordField
          label="รหัสผ่านใหม่"
          name="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="ยืนยันรหัสผ่านใหม่"
          name="confirmPassword"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {token === null && <Notice tone="danger">ลิงก์รีเซ็ตไม่ถูกต้อง โปรดขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน</Notice>}
        {message && <Notice tone={isSuccess ? "success" : "danger"}>{message}</Notice>}

        <SubmitButton loading={isLoading}>บันทึกรหัสผ่านใหม่</SubmitButton>
      </form>
    </AuthLayout>
  );
}
