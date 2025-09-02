'use client';

export default function UploadTrigger() {
  const open = () => {
    window.dispatchEvent(new CustomEvent('open-upload'));
  };
  return (
    <button
      onClick={open}
      className="rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
      type="button"
    >
      Upload
    </button>
  );
}
