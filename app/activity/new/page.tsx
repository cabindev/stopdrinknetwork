// app/activity/new/page.tsx — ฟอร์มบันทึกการดำเนินงาน (ต้อง login)
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import authOptions from '@/app/lib/configs/auth/authOptions';
import ActivityForm from '../components/ActivityForm';
import { teamPeople } from '@/app/lib/activityAccess';
import { canCreateActivity } from '@/app/lib/activityMeta';

export default async function NewActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/auth/signin');
  }
  if (!canCreateActivity(session.user.role)) redirect('/activity'); // เพิ่มงานได้เฉพาะแอดมิน
  const people = await teamPeople();

  return (
    <main className="min-h-screen bg-white pt-20 pb-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/activity"
          className="inline-flex items-center gap-1.5 text-sm text-orange-700 hover:text-orange-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> งานของฉัน
        </Link>

        <h1 className="text-2xl font-bold text-gray-800">บันทึกการดำเนินงาน</h1>
        <p className="mt-1 mb-8 text-sm text-gray-500">
          1 รายการ = งาน 1 ประเด็นใน 1 พื้นที่ — ข้อมูลจะแสดงในโปรไฟล์ของคุณและแผนที่รวมขององค์กร
        </p>

        <ActivityForm people={people} currentUserId={Number(session.user.id)} />
      </div>
    </main>
  );
}
