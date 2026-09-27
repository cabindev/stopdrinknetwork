// app/dashboard/layout.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import authOptions from '../lib/configs/auth/authOptions';
import { DashboardProvider } from './context/DashboardContext';
import { TopNavProvider } from './context/TopNavContext';
import DashboardClient from './components/DashboardClient';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/dashboard');
  }

  return (
    <DashboardProvider>
      <TopNavProvider>
        <DashboardClient user={session.user}>
          {children}
        </DashboardClient>
      </TopNavProvider>
    </DashboardProvider>
  );
}
