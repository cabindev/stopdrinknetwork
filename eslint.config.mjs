// ESLint (flat config) ตามคู่มือ Next 16 — `next lint` ถูกถอดแล้ว ใช้ `npm run lint` (= eslint .)
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // กฎชุด React Compiler (react-hooks v6) จับโค้ดเดิมที่ทำงานถูกอยู่ (setState ใน effect, อ่าน ref ตอน render,
    // Date.now() ใน server component) — เตือนไว้ก่อน แก้ทีละจุดเมื่อแตะไฟล์นั้น ไม่รื้อทั้งระบบทีเดียว
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // ขึ้นต้นด้วย _ = ตั้งใจไม่ใช้ (คงลายเซ็นฟังก์ชันไว้)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  // server.js = CommonJS ที่ Passenger (Plesk) โหลดตรง ๆ
  { files: ['server.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  // สคริปต์ QA ส่ง default export เป็น function ไม่มีชื่อให้ browser.mjs เรียก
  { files: ['scripts/**'], rules: { 'import/no-anonymous-default-export': 'off' } },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'uploads/**',
    'backups/**',
    'app/data/**', // ข้อมูลอ้างอิงขนาดใหญ่ (regions/GeoJSON) ไม่ใช่โค้ด
  ]),
]);
