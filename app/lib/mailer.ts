// app/lib/mailer.ts — ส่งอีเมลผ่าน Gmail SMTP (EMAIL_USER / EMAIL_PASS) ใช้ร่วมทั้งระบบ
import nodemailer from 'nodemailer';
import prisma from '@/app/lib/db';

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const esc = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// มีคนสมัครใหม่ (role pending) → แจ้งแอดมินทุกคนให้เข้าไปอนุมัติ/ปฏิเสธ
// ไม่ throw: ส่งเมลพลาดต้องไม่ทำให้การสมัครล้ม (เรียกแบบไม่ await ได้) · ไม่มี EMAIL_USER = ข้าม (เครื่อง dev)
export async function notifyAdminsOfSignup(user: { firstName: string; lastName: string; email: string; via: 'form' | 'google' }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'superadmin'] } },
      select: { email: true },
    });
    const to = admins.map((a) => a.email).filter((e) => !e.endsWith('@test.sdn')); // บัญชีทดสอบไม่มีกล่องจดหมายจริง
    if (to.length === 0) return;
    const link = new URL('/dashboard/setting/admin', process.env.NEXTAUTH_URL || 'http://localhost:3000').toString();
    const name = `${user.firstName} ${user.lastName}`.trim();
    await transporter.sendMail({
      from: `"Stop Drink Network" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      bcc: to, // ไม่เปิดเผยอีเมลแอดมินคนอื่นในหัวจดหมาย
      subject: `บัญชีใหม่รออนุมัติ: ${name}`,
      text: `${name} (${user.email}) สมัครใช้งานผ่าน${user.via === 'google' ? ' Google' : 'แบบฟอร์ม'}\nอนุมัติหรือปฏิเสธได้ที่ ${link}`,
      html: `<div style="font-family:Tahoma,sans-serif;font-size:14px;color:#1f2937">
        <p><b>${esc(name)}</b> (${esc(user.email)}) สมัครใช้งานผ่าน${user.via === 'google' ? ' Google' : 'แบบฟอร์ม'}</p>
        <p>ระหว่างรออนุมัติ บัญชีนี้เห็นแค่แผนที่สาธารณะและกรณีศึกษา</p>
        <p><a href="${link}" style="display:inline-block;background:#ea580c;color:#fff;padding:8px 16px;border-radius:9999px;text-decoration:none">อนุมัติ / ปฏิเสธ</a></p>
      </div>`,
    });
  } catch (err) {
    console.error('notifyAdminsOfSignup failed:', err);
  }
}
