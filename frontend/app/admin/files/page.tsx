'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type Item = {
  filename: string;
  size: number;
  uploaded_at: string;
};

export default function FilesAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  const load = async () => {
    try {
      setLoading(true);
      setErr('');
      const res = await api.get('/documents');
      setItems(Array.isArray(res.data) ? res.data : res.data?.items ?? []);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('refresh-documents', handler as EventListener);
    return () => window.removeEventListener('refresh-documents', handler as EventListener);
  }, []);

  const bytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  };

  // DD/MM/YYYY HH:MM:SS
  const formatCz = (iso: string) => {
    const d = new Date(iso);
    const pad = (x: number) => x.toString().padStart(2, '0');
    const DD = pad(d.getDate());
    const MM = pad(d.getMonth() + 1);
    const YYYY = d.getFullYear();
    const HH = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    return `${DD}/${MM}/${YYYY} ${HH}:${m}:${s}`;
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await api.delete(`/documents/${encodeURIComponent(name)}`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.message ?? 'Delete failed');
    }
  };

  return (
    <div className="mx-auto w/full max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-start">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-white/70 p-6">
            <p className="text-center text-slate-600">
            No documents yet. Use <span className="font-medium">Upload</span> to add some.
            </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white/70">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Filename
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Uploaded
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((it) => (
                <tr key={it.filename} className="hover:bg-slate-50/60">
                  <td className="max-w-[360px] truncate px-4 py-3 font-medium text-slate-800">
                    {it.filename}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{bytes(it.size)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCz(it.uploaded_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(it.filename)}
                      className="rounded-lg border px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
