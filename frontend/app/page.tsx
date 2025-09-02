'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Page() {
  const [inputValue, setInputValue] = useState("");
  const router = useRouter();

  const submit = () => {
    const v = (inputValue || '').trim();
    if (!v) return;
    try { sessionStorage.setItem('initialChatQuestion', v); } catch {}
    router.push('/chat');
  };

  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative mx-auto mt-14 grid max-w-[1100px] gap-8 px-2 text-center">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            Centralized resources
          </span>
          , research, and collaboration<br /> for the age of intelligent systems
        </h1>
        <p className="mx-auto max-w-2xl text-base text-slate-600 md:text-lg">
          Explore our hub where company knowledge, citations and secure retrieval converge.
        </p>

        <div className="mx-auto flex gap-3">
          <a
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900 shadow-sm hover:bg-slate-50"
            href="#"
          >
            About
          </a>
          <Link
            href="/chat"
            className="rounded-xl bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800"
          >
            Explore more
          </Link>
        </div>

        {/* Robot */}
        <div className="relative mx-auto mt-6 h-72 w-72 z-10">
          <Image
            src="/robot-hero.png"
            alt="AI Robot mascot"
            fill
            priority
            className="object-contain drop-shadow-xl"
          />
        </div>

        {/* Tvůj vyhledávací/input panel – UI beze změny, jen logika Enter/click */}
        <div
          className="mx-auto -mt-24 w-full max-w-[95%] rounded-2xl bg-white/30 p-4 shadow-lg backdrop-blur-md z-20 flex items-center"
          style={{
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            background: 'rgba(255,255,255,0.18)',
          }}
        >
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              placeholder="Ask anything to the Hub or use @handle to reach a specific agent…"
              className="flex-1 rounded-xl border bg-white/20 px-4 py-3 text-left text-slate-500 placeholder:text-slate-400 outline-none"
              style={{ background: 'rgba(255,255,255,0.20)' }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm flex items-center"
                type="button"
                aria-label="Voice"
              >🎤</button>
              <Link
                href="/chat"
                className="rounded-xl bg-slate-900 px-4 py-2 text-white flex items-center"
                onClick={(e) => {
                  const v = (inputValue || '').trim();
                  if (v) {
                    try { sessionStorage.setItem('initialChatQuestion', v); } catch {}
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                ⌲
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
