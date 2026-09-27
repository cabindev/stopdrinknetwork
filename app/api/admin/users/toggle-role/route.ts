// app/api/admin/users/toggle-role/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/app/lib/configs/auth/authOptions';
import prisma from '@/app/lib/db';

export async function POST(request: NextRequest) {
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
      select: { id: true, role: true }
    });

    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const { userId, role } = await request.json();

    // Validate input
    if (!userId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and role' },
        { status: 400 }
      );
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "member"' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, email: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent admin from demoting themselves
    if (targetUser.id === currentUser.id && role === 'member') {
      return NextResponse.json(
        { error: 'Cannot demote yourself from admin role' },
        { status: 400 }
      );
    }

    // แก้ role ของ superadmin ได้เฉพาะ superadmin ด้วยกันเท่านั้น
    if (targetUser.role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only superadmin can change a superadmin role' },
        { status: 403 }
      );
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      message: 'User role updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
