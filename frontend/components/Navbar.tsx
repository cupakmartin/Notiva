'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import UploadTrigger from './UploadTrigger';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isDocuments = pathname === '/documents';

  const onRefresh = () => {
    if (isDocuments) {
      window.dispatchEvent(new Event('refresh-documents'));
      router.refresh();
    }
  };

  return (
    <nav className="mt-6 flex items-center justify-between rounded-2xl bg-white/70 px-5 py-3 shadow-sm backdrop-blur">
      {/* logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow">
          <span className="text-lg font-semibold">nt</span>
        </div>
        <Link href="/" className="text-lg font-semibold hover:underline">Notiva</Link>
      </div>

      {/* links */}
      <div className="hidden gap-6 md:flex text-sm text-slate-600">
        <Link className="hover:text-slate-900" href="/">Home</Link>
        <a className="hover:text-slate-900" href="#">Product</a>
        <a className="hover:text-slate-900" href="#">About</a>
        <a className="hover:text-slate-900" href="#">Community</a>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2">
        {isDocuments ? (
          <button
            onClick={onRefresh}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        ) : (
          <Link
            href="/chat"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Chat
          </Link>
        )}
        <Link
          href="/documents"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Documents
        </Link>
        <UploadTrigger />
      </div>
    </nav>
  );
}
