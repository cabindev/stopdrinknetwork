// app/lib/db.ts
// Prisma singleton + กรองงานในถังขยะ (Activity.deletedAt) ออกจากทุก query อ่านโดยอัตโนมัติ
// — ไม่ต้องจำใส่ deletedAt: null ทุกหน้า · หน้า "ถังขยะ" ระบุ deletedAt เองใน where จึงไม่ถูกทับ
// ⚠️ ไม่ครอบคลุม relation ซ้อน (include/_count ของ User/Category และ where แบบ { activity: {...} })
//    ต้องใส่ deletedAt: null เอง — ดู ACTIVE_ACTIVITY ด้านล่าง
import { PrismaClient } from '@prisma/client'

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
])

// ใช้ใน relation filter/_count เช่น _count: { select: { activities: { where: ACTIVE_ACTIVITY } } }
export const ACTIVE_ACTIVITY = { deletedAt: null } as const

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  }).$extends({
    query: {
      activity: {
        async $allOperations({ operation, args, query }) {
          if (READ_OPS.has(operation)) {
            const a = args as { where?: Record<string, unknown> }
            if (!a.where || !('deletedAt' in a.where)) a.where = { ...a.where, deletedAt: null }
          }
          return query(args)
        },
      },
    },
  })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
