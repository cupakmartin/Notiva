'use client';
import { useState } from 'react';
import { api } from '../lib/api';

export default function UploadBox() {
  const [file, setFile] = useState<File|null>(null);
  const [status, setStatus] = useState<string>('');

  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setStatus('Uploading...');
    const res = await api.post(`/documents/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setStatus(`Done: ${res.data.filename} (chunks: ${res.data.chunks})`);
  };

  return (
    <div className="card">
      <h2 className="mb-4 text-xl font-semibold">📤 Upload document</h2>
      <div className="flex items-center gap-3">
        <input type="file" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="text-sm" />
        <button onClick={upload} className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">Upload</button>
      </div>
      {status && <div className="mt-3 text-sm text-slate-600">{status}</div>}
    </div>
  );
}
