import { notFound } from 'next/navigation';
import ringsData   from '@/content/size-guides/rings.json';
import banglesData from '@/content/size-guides/bangles.json';
import chainsData  from '@/content/size-guides/chains.json';

const GUIDES: Record<string, typeof ringsData | typeof banglesData | typeof chainsData> = {
  rings:   ringsData,
  bangles: banglesData,
  chains:  chainsData,
};

interface PageProps {
  params: { category: string };
}

export function generateStaticParams() {
  return [{ category: 'rings' }, { category: 'bangles' }, { category: 'chains' }];
}

export default function SizeGuidePage({ params }: PageProps) {
  const guide = GUIDES[params.category];
  if (!guide) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a
        href="/products"
        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
      >
        ← उत्पाद देखें
      </a>

      <h1 className="font-heading text-3xl text-ink mb-2">{guide.titleHi}</h1>
      <p className="font-body text-sm text-inkMute mb-6">{guide.introHi}</p>

      <div className="rounded-lg border border-border bg-white p-4 mb-6">
        <p className="font-body text-sm text-ink font-medium">📏 {guide.measureHi}</p>
      </div>

      {/* Rings table */}
      {'sizes' in guide && guide.category === 'rings' && (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm border-collapse">
            <thead>
              <tr className="bg-primary/10">
                <th className="border border-border px-3 py-2 text-left text-ink">भारतीय साइज़</th>
                <th className="border border-border px-3 py-2 text-left text-ink">परिधि (mm)</th>
                <th className="border border-border px-3 py-2 text-left text-ink">व्यास (mm)</th>
              </tr>
            </thead>
            <tbody>
              {(guide as typeof ringsData).sizes.map((row) => (
                <tr key={row.indian} className="even:bg-bg">
                  <td className="border border-border px-3 py-2 text-ink font-medium">{row.indian}</td>
                  <td className="border border-border px-3 py-2 text-ink">{row.circumferenceMm}</td>
                  <td className="border border-border px-3 py-2 text-ink">{row.diameterMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bangles table */}
      {'sizes' in guide && guide.category === 'bangles' && (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm border-collapse">
            <thead>
              <tr className="bg-primary/10">
                <th className="border border-border px-3 py-2 text-left text-ink">साइज़</th>
                <th className="border border-border px-3 py-2 text-left text-ink">व्यास (mm)</th>
                <th className="border border-border px-3 py-2 text-left text-ink">परिधि (mm)</th>
              </tr>
            </thead>
            <tbody>
              {(guide as typeof banglesData).sizes.map((row) => (
                <tr key={row.diameterMm} className="even:bg-bg">
                  <td className="border border-border px-3 py-2 text-ink font-medium">{row.labelHi}</td>
                  <td className="border border-border px-3 py-2 text-ink">{row.diameterMm}</td>
                  <td className="border border-border px-3 py-2 text-ink">{row.circumferenceMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chains table */}
      {'sizes' in guide && guide.category === 'chains' && (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm border-collapse">
            <thead>
              <tr className="bg-primary/10">
                <th className="border border-border px-3 py-2 text-left text-ink">लंबाई (इंच)</th>
                <th className="border border-border px-3 py-2 text-left text-ink">प्रकार</th>
                <th className="border border-border px-3 py-2 text-left text-ink">स्टाइल</th>
              </tr>
            </thead>
            <tbody>
              {(guide as typeof chainsData).sizes.map((row) => (
                <tr key={row.inches} className="even:bg-bg">
                  <td className="border border-border px-3 py-2 text-ink font-medium">{row.inches}"</td>
                  <td className="border border-border px-3 py-2 text-ink">{row.labelHi}</td>
                  <td className="border border-border px-3 py-2 text-inkMute">{row.styleHi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
