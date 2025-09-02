'use client';

import { useEffect, useRef, useState } from 'react';
import type { AxiosProgressEvent } from 'axios';
import { api } from '../lib/api';

type FileRow = {
  file: File;
  progress: number; // 0..100
  status: 'queued' | 'uploading' | 'done' | 'error';
  message?: string;
};

type UrlJob = {
  url: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  message?: string;
};

type UploadResponse = {
  status: 'uploaded' | 'skipped' | 'replaced';
  file: { filename: string; sha256: string; size: number };
};

const MAX_MB = 25;
const ACCEPTED = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function UploadModal() {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [urlJob, setUrlJob] = useState<UrlJob>({ url: '', status: 'idle' });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('open-upload', onOpen as EventListener);
    return () => window.removeEventListener('open-upload', onOpen as EventListener);
  }, []);

  const close = () => {
    setOpen(false);
    setDragOver(false);
    setRows([]);
    setUrlJob({ url: '', status: 'idle' });
  };

  const prevented = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const validate = (f: File): string | null => {
    if (f.size > MAX_MB * 1024 * 1024) return `File too large (>${MAX_MB}MB)`;
    if (!ACCEPTED.includes(f.type)) return `Unsupported type: ${f.type || 'unknown'}`;
    return null;
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: FileRow[] = [];
    Array.from(files).forEach((f) => {
      const err = validate(f);
      next.push({
        file: f,
        progress: 0,
        status: err ? 'error' : 'queued',
        message: err || undefined,
      });
    });
    setRows((prev) => [...prev, ...next]);
  };

  const onDrop = (e: React.DragEvent) => {
    prevented(e);
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const chooseFile = () => inputRef.current?.click();

  const uploadOne = async (rowIndex: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, status: 'uploading', progress: 0, message: '' } : r)),
    );
    const row = rows[rowIndex];

    try {
      const form = new FormData();
      form.append('file', row.file);

      const res = await api.post<UploadResponse>('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (p: AxiosProgressEvent) => {
          const total = typeof p.total === 'number' && p.total > 0 ? p.total : row.file.size || 1;
          const loaded = typeof p.loaded === 'number' ? p.loaded : 0;
          const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
          setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, progress: pct } : r)));
        },
      });

      const payload = res.data;
      const name =
        (payload && payload.file && payload.file.filename) ? payload.file.filename : row.file.name;

      let message = `Uploaded: ${name}`;
      if (payload?.status === 'skipped') {
        message = `Already exists (unchanged): ${name}`;
      } else if (payload?.status === 'replaced') {
        message = `Replaced with new version: ${name}`;
      }

      setRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex ? { ...r, status: 'done', progress: 100, message } : r,
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      let message = err?.message ?? 'Upload failed';
      if (status === 404) {
        message = 'Endpoint not found (404). Zkontroluj prosím, že backend má cestu /documents/upload (bez dvojitého /documents).';
      } else if (status === 409) {
        message = 'A file with the same name already exists and the server refused to replace it (409).';
      } else if (status === 413) {
        message = 'File too large (server rejected it).';
      } else if (status === 415) {
        message = 'Unsupported media type.';
      } else if (status === 401 || status === 403) {
        message = 'Unauthorized – check your auth token.';
      } else if (status === 500) {
        message = 'Server error while processing the file.';
      } else if (err?.code === 'ERR_NETWORK') {
        message = 'Network error – is the backend reachable?';
      }
      setRows((prev) =>
        prev.map((r, i) =>
          i === rowIndex ? { ...r, status: 'error', message } : r,
        ),
      );
    }
  };

  const uploadAll = async () => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === 'queued') {
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(i);
      }
    }
  };

  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const importFromUrl = async () => {
    if (!urlJob.url.trim()) return;
    try {
      setUrlJob((j) => ({ ...j, status: 'uploading', message: '' }));
      const res = await api.post('/documents/upload-url', { url: urlJob.url.trim() });
      const fname =
        res.data?.file?.filename ??
        res.data?.filename ??
        urlJob.url.trim();

      const statusTxt =
        res.data?.status === 'skipped'
          ? 'Already exists (unchanged)'
          : res.data?.status === 'replaced'
          ? 'Replaced with new version'
          : 'Imported';

      setUrlJob({ url: '', status: 'done', message: `${statusTxt}: ${fname}` });
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      let message = err?.message ?? 'URL import failed';
      if (status === 400) {
        message = 'Invalid URL or unsupported content at the URL.';
      } else if (status === 409) {
        message = 'A document from this URL already exists (409).';
      } else if (status === 401 || status === 403) {
        message = 'Unauthorized – check your auth token.';
      } else if (status === 500) {
        message = 'Server error while fetching the URL.';
      } else if (err?.code === 'ERR_NETWORK') {
        message = 'Network error – is the backend reachable?';
      }
      setUrlJob((j) => ({ ...j, status: 'error', message }));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      {/* modal */}
      <div className="relative z-[101] w-[92vw] max-w-2xl rounded-2xl bg-white/90 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
        {/* header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add documents</h3>
          <button
            onClick={close}
            className="rounded-full border px-3 py-1 text-sm hover:bg-slate-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* dropzone */}
        <div
          onDragEnter={(e) => {
            prevented(e);
            setDragOver(true);
          }}
          onDragOver={prevented}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-6 text-center ${
            dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white/70'
          }`}
        >
          <div className="mx-auto mb-3 h-8 w-8 text-2xl">⬆️</div>
          <div className="text-slate-700">
            Drag &amp; Drop or{' '}
            <button
              onClick={chooseFile}
              className="text-indigo-600 underline underline-offset-2"
              type="button"
            >
              Choose files
            </button>{' '}
            to upload
          </div>
          <div className="mt-1 text-xs text-slate-500">PDF, DOCX, TXT, CSV • up to {MAX_MB}MB/file</div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {/* file list */}
          {rows.length > 0 && (
            <div className="mt-4 space-y-2">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-xl border bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-700">{r.file.name}</div>
                      <div className="text-xs text-slate-500">
                        {(r.file.size / 1024).toFixed(0)} KB
                        {r.status === 'uploading' && ` • ${r.progress}%`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === 'queued' && (
                        <button
                          onClick={() => uploadOne(idx)}
                          className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
                        >
                          Upload
                        </button>
                      )}
                      <button
                        onClick={() => removeRow(idx)}
                        className="rounded-full border px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* ERROR progress */}
                  {r.status === 'error' && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                  )}

                  {/* UPLOADING / DONE progress */}
                  {(r.status === 'uploading' || r.status === 'done') && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                  )}

                  {/* message */}
                  {r.message && (
                    <div
                      className={`mt-2 text-xs ${
                        r.status === 'error' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {r.message}
                    </div>
                  )}
                </div>
              ))}

              {/* Upload All */}
              {rows.some((r) => r.status === 'queued') && (
                <div className="flex justify-end">
                  <button
                    onClick={uploadAll}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                  >
                    Upload all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OR separator */}
        <div className="my-4 flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>OR</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* URL import */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={urlJob.url}
            onChange={(e) => setUrlJob((j) => ({ ...j, url: e.target.value }))}
            placeholder="Add file URL"
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <button
            onClick={importFromUrl}
            disabled={!urlJob.url.trim() || urlJob.status === 'uploading'}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
          >
            {urlJob.status === 'uploading' ? 'Importing…' : 'Import'}
          </button>
        </div>

        {/* footer status */}
        <div className="mt-3 flex items-center justify-between">
          <a className="text-sm text-slate-500 hover:underline" href="#" onClick={(e) => e.preventDefault()}>
            Help Center
          </a>
          <div className="text-sm">
            {urlJob.status === 'done' && <span className="text-emerald-600">{urlJob.message}</span>}
            {urlJob.status === 'error' && <span className="text-rose-600">{urlJob.message}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
