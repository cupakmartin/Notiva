import '../styles/globals.css';
import { Sora, Inter } from 'next/font/google';
import dynamic from 'next/dynamic';
import Navbar from '../components/Navbar';

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700'] });
const inter = Inter({ subsets: ['latin'] });
const UploadModal = dynamic(() => import('../components/UploadModal'), { ssr: false });

export const metadata = { title: 'Notiva' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.className} ${inter.className}`}>
      <body className="min-h-screen bg-[#f6f7fb] text-slate-900 antialiased">
        {/* background */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f6f7fb] to-[#eef2ff]" />
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-200 blur-3xl opacity-40" />
          <div className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-purple-200 blur-3xl opacity-40" />
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <Navbar />
          {children}
        </div>

        <UploadModal />
      </body>
    </html>
  );
}
