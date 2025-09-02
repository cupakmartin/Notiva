'use client';
import { useState } from 'react';
import { api } from '../../lib/api';

type ModalState = {
  open: boolean;
  type: 'success' | 'error';
  title: string;
  msg: string;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    type: 'success',
    title: '',
    msg: '',
  });

  const openError = (msg: string) =>
    setModal({ open: true, type: 'error', title: 'Error', msg });

  const openSuccess = (msg: string) =>
    setModal({ open: true, type: 'success', title: 'Completed', msg });

  const extractErrMessage = (e: any): string => {
    const d = e?.response?.data;
    if (!d) return e?.message ?? 'Unknown error';
    if (typeof d === 'string') return d;
    if (typeof d?.detail === 'string') return d.detail;
    if (typeof d?.detail === 'object' && d.detail?.message) return d.detail.message;
    try {
      return JSON.stringify(d.detail ?? d);
    } catch {
      return String(d.detail ?? d);
    }
  };

  const onUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      // pre-check
      try {
        const chk = await api.get('/documents/check', { params: { name: file.name } });
        if (chk?.data?.exists) {
          openError(`Soubor „${file.name}“ už v systému existuje.`);
          return;
        }
      } catch { /* ignore */ }

      const fd = new FormData();
      fd.append('file', file);

      await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      openSuccess(`Soubor „${file.name}“ byl úspěšně nahrán.`);
      setFile(null);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        const name = e?.response?.data?.detail?.existing || file?.name || '';
        const msg = e?.response?.data?.detail?.message || 'Soubor již existuje.';
        openError(`${msg} (→ ${name})`);
      } else {
        openError(`Nahrání selhalo: ${extractErrMessage(e)}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Nahrát dokument</h1>

      <div className="bg-white rounded-2xl p-6 border shadow-sm">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="mt-4 flex gap-3">
          <button
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
            onClick={onUpload}
            disabled={!file || busy}
          >
            {busy ? 'Nahrávám…' : 'Nahrát'}
          </button>
          <a className="px-5 py-2 rounded-xl border" href="/">Zpět na Home</a>
          <a className="px-5 py-2 rounded-xl border" href="/admin/files">Správa souborů</a>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[360px] text-center shadow-xl">
            <div
              className={`mx-auto mb-3 w-10 h-10 rounded-full flex items-center justify-center ${
                modal.type === 'error'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {modal.type === 'error' ? '✕' : '✓'}
            </div>

            <h3 className="text-lg font-semibold mb-2">{modal.title}</h3>

            <p className="text-slate-600 text-sm mb-4">{modal.msg}</p>

            <div className="flex justify-center gap-3">
              <button
                className="px-4 py-2 rounded-xl border"
                onClick={() => setModal((m) => ({ ...m, open: false }))}
              >
                Ok, Close
              </button>
              <a className="px-4 py-2 rounded-xl bg-slate-900 text-white" href="/admin/files">
                Open File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
