import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Goldsmith Platform Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <header className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between max-w-6xl mx-auto">
        <h1 className="text-xl font-semibold">Goldsmith Platform Admin</h1>
        <span className="text-xs text-slate-500 uppercase tracking-wider">internal</span>
      </header>
      <div className="max-w-6xl mx-auto">{children}</div>
    </div>
  );
}
