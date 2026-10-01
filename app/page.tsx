import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col pt-16">
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 pt-16 pb-16 text-center">
        <span className="inline-block text-4xl font-extrabold tracking-wide text-orange-600 mb-8">SDN</span>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 leading-tight">
          Stop Drink <span className="text-orange-600">Network</span>
        </h1>
        <p className="mt-4 text-gray-600 leading-relaxed max-w-xl mx-auto">
          Intervention Areas : Stop Drink Network
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 shadow-lg shadow-orange-500/30 transition-all"
          >
            สมัครสมาชิก
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-orange-200 text-orange-700 text-sm font-medium hover:bg-orange-50 transition-colors"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          อยากเห็นตัวอย่างพื้นที่ที่ทำสำเร็จ?{' '}
          <Link href="/stories" className="font-medium text-orange-700 underline">
            อ่านกรณีศึกษา
          </Link>{' '}
          หรือ{' '}
          <Link href="/map" className="font-medium text-orange-700 underline">
            ดูแผนที่งานทั่วประเทศ
          </Link>
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-orange-100 py-6">
        <p className="text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Stop Drink Network — เครือข่ายงดเหล้า
        </p>
      </footer>
    </main>
  );
}
