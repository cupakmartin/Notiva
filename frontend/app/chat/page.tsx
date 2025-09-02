'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import Chat from '../../components/Chat';
import UploadTrigger from '../../components/UploadTrigger';

const UploadModal = dynamic(() => import('../../components/UploadModal'), { ssr: false });

export default function ChatPage() {
  return (
    <main className="relative">
      {/* Glass (frosted) chat container */}
      <section className="mx-auto mt-10 flex max-w-5xl items-start justify-center px-2">
        <div className="w-full rounded-3xl bg-white/60 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
          <Chat />
        </div>
      </section>

      {/* Modal mount point */}
      <UploadModal />
    </main>
  );
}
