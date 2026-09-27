// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';

export async function GET() {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { role: true }
    });

    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate stats
    const totalUsers = users.length;
    const totalAdmins = users.filter(user => user.role === 'admin').length;
    const totalMembers = users.filter(user => user.role === 'member').length;

    // Recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = users.filter(user =>
      new Date(user.createdAt) >= sevenDaysAgo
    ).length;

    const stats = {
      totalUsers,
      totalAdmins,
      totalMembers,
      recentUsers
    };

    return NextResponse.json({
      users,
      stats
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
