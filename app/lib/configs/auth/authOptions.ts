//lib/configs/auth/authOptions.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { User as PrismaUser } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '@/app/lib/db';

interface Credentials {
  email: string;
  password: string;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      image?: string;
    };
  }

  interface User {
    id: number;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    picture?: string;
  }
}
const authOptions: NextAuthOptions = {
  // ไม่ใช้ PrismaAdapter เพราะ schema ไม่มี model Account/Session/VerificationToken
  // (แนวเดียวกับ activerun) — ตอน login ด้วย Google จึง find-or-create User เองใน callbacks.signIn
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'john@doe.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Credentials | undefined) {
        if (!credentials) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error('No user found with this email');
        }

        if (!user.password) {
          throw new Error('Invalid password');
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);

        if (!isValidPassword) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin', // error ของ OAuth จะกลับมาหน้านี้พร้อม ?error=
  },
  callbacks: {
    // Google ยืนยันอีเมลมาแล้ว → อีเมลตรงกับบัญชีเดิม = เข้าบัญชีเดิม (ไม่แตะรหัสผ่าน/role/โปรไฟล์ที่แก้ไว้)
    // อีเมลใหม่ = สร้างบัญชี role member เสมอ (ไม่มีอีเมลไหนได้ admin อัตโนมัติ)
    signIn: async ({ user, account, profile }) => {
      if (account?.provider !== 'google') return true;

      const g = profile as { email?: string; email_verified?: boolean; given_name?: string; family_name?: string } | undefined;
      const email = (g?.email ?? user.email)?.toLowerCase();
      if (!email || g?.email_verified === false) return false;

      const [first, ...rest] = (user.name ?? email.split('@')[0]).trim().split(/\s+/);
      const existing = await prisma.user.findUnique({ where: { email } });
      const dbUser = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            // เติมเฉพาะที่ยังว่าง — ไม่ทับรูป/ชื่อที่ผู้ใช้ตั้งเองในหน้าแก้ไขโปรไฟล์
            data: {
              emailVerified: existing.emailVerified ?? new Date(),
              ...(!existing.image && user.image ? { image: user.image } : {}),
            },
          })
        : await prisma.user.create({
            data: {
              email,
              firstName: g?.given_name || first,
              lastName: g?.family_name || rest.join(' '),
              image: user.image ?? null,
              role: 'member',
              emailVerified: new Date(),
            },
          });

      // ส่งค่าจาก DB ต่อให้ jwt callback (id ของ Google เป็น string ต้องแทนด้วย id ของเรา)
      Object.assign(user, {
        id: dbUser.id,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        image: dbUser.image,
      });
      return true;
    },
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = (user as PrismaUser).id;
        token.firstName = (user as PrismaUser).firstName;
        token.lastName = (user as PrismaUser).lastName;
        token.role = (user as PrismaUser).role;
        token.picture = user.image ?? undefined;
      }
      // ผู้ใช้แก้โปรไฟล์แล้วเรียก update() — อัปเดต token ให้ Navbar เปลี่ยนตามทันที
      if (trigger === 'update' && session) {
        if (session.firstName) token.firstName = session.firstName;
        if (session.lastName) token.lastName = session.lastName;
        token.picture = session.image ?? null;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.role = token.role;
        session.user.image = token.picture;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

export default authOptions;
