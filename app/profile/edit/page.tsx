// app/profile/edit/page.tsx — แก้ไขโปรไฟล์ของตัวเอง (ต้อง login)
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';
import ProfileForm from '../components/ProfileForm';

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      image: true,
      phone: true,
      organization: true,
      position: true,
    },
  });
  if (!user) redirect('/auth/signin');

  return (
    <main className="min-h-screen bg-white pt-20 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> กลับไปหน้าโปรไฟล์
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">แก้ไขโปรไฟล์</h1>
        <p className="text-sm text-gray-500 mb-8">
          ข้อมูลติดต่อจะแสดงให้เพื่อนร่วมพื้นที่เห็น เพื่อให้ประสานงานกันได้ง่ายขึ้น
        </p>
        <ProfileForm initial={user} />
      </div>
    </main>
  );
}
