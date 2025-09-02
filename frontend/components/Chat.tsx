'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { api } from '../lib/api';

type Role = 'user' | 'assistant';
type Source = { title: string; page?: number; snippet?: string };

type Msg = {
  role: Role;
  content: string;
  sources?: Source[];
};

export default function Chat() {
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  // Autoscroll dolů při přidání zprávy
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [msgs]);

  // Auto-odeslání dotazu z homepage (sessionStorage)
  useEffect(() => {
    try {
      const storedQ = sessionStorage.getItem('initialChatQuestion');
      if (storedQ && storedQ.trim()) {
        sessionStorage.removeItem('initialChatQuestion');
        setQ(storedQ);
        ask(storedQ);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = async (overrideQ?: string) => {
    const question = (overrideQ ?? q).trim();
    if (!question || busy) return;

    const userMsg: Msg = { role: 'user', content: question };
    setMsgs((prev) => [...prev, userMsg]);
    setQ('');
    setBusy(true);

    try {
      // Přizpůsob dle svého API – zde POST /chat { query, top_k }
      const res = await api.post('/chat', { query: userMsg.content, top_k: 5 });

      const answer: string =
        (res.data?.answer as string) ?? 'Omlouvám se, ale žádná odpověď nebyla nalezena.';

      const sources: Source[] = Array.isArray(res.data?.citations)
        ? (res.data.citations as Array<{ source: string; snippet?: string; page?: number }>).map(
            (c) => ({
              title: c.source,
              snippet: c.snippet,
              page: c.page,
            }),
          )
        : [];

      const aiMsg: Msg = { role: 'assistant', content: answer, sources };
      setMsgs((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      setMsgs((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Chyba při volání API: ${e?.message ?? String(e)}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col justify-between" style={{ background: 'transparent' }}>
      {/* Header – zachován minimalisticky (pokud už máš jiný, ponech) */}
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-indigo-400/60">
            <Image src="/robot-hero.png" alt="AI Avatar" fill />
          </div>
          <div className="text-sm text-slate-600">NotivAI</div>
        </div>
        <div className="text-xs text-slate-400">{busy ? 'Processing…' : 'Ready'}</div>
      </div>

      {/* Chat body – tvoje původní bubliny */}
      <div
        ref={chatBodyRef}
        className="space-y-4 flex-1 p-4 overflow-y-auto w-full"
        style={{
          background: 'transparent',
          borderRadius: '1rem',
          border: 'none',
        }}
      >
        {msgs.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-2xl shadow-lg backdrop-blur-lg border text-slate-900 whitespace-pre-wrap prose prose-sm ${m.role === 'user'
                ? 'bg-gradient-to-r from-indigo-400/40 to-purple-300/40 text-right'
                : 'bg-white/30 text-left'}
              `}
              style={m.role === 'user'
                ? {
                    background: 'linear-gradient(90deg, rgba(139,92,246,0.25) 0%, rgba(99,102,241,0.25) 100%)',
                    color: '#312e81',
                    border: '1px solid rgba(139,92,246,0.18)',
                  }
                : {
                    background: 'rgba(255,255,255,0.18)',
                    color: '#334155',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }
              }
            >
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                {m.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div>{m.content}</div>

              {!!m.sources?.length && (
                <div className="mt-3 rounded-xl bg-slate-50/60 p-3 text-sm text-slate-700">
                  <div className="mb-2 font-medium">Zdroje</div>
                  <ul className="list-disc pl-5">
                    {m.sources.map((s, i) => (
                      <li key={i} className="break-all">
                        <span className="font-medium">{s.title}</span>
                        {s.snippet ? <span className="text-slate-500"> — {s.snippet}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input – beze změny UI */}
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900/40"
            style={{
              background: 'rgba(255,255,255,0.10)',
              color: '#312e81',
              border: '1px solid rgba(139,92,246,0.10)',
            }}
            placeholder="Zeptejte se na dokumenty…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            disabled={busy}
          />
          <button
            onClick={() => ask()}
            disabled={busy}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
