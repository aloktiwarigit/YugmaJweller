interface SectionHeadingProps {
  id: string;
  titleHi: string;
  eyebrowHi?: string;
  eyebrowEn?: string;
  pill?: { labelHi: string; className?: string };
}

export function SectionHeading({ id, titleHi, eyebrowHi, eyebrowEn, pill }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-1 mb-6">
      {(eyebrowHi || eyebrowEn) && (
        <p className="font-prose italic text-xs text-inkSoft tracking-wide" aria-hidden="true">
          {eyebrowHi}
          {eyebrowEn && <span className="not-italic"> / {eyebrowEn}</span>}
        </p>
      )}
      <div className="flex items-center gap-3">
        {pill && (
          <span className={`font-ui text-xs font-semibold px-2 py-0.5 rounded-pill ${pill.className ?? 'bg-accentWash text-accent'}`}>
            {pill.labelHi}
          </span>
        )}
        <h2 id={id} className="font-heading text-2xl text-ink">
          {titleHi}
        </h2>
      </div>
    </div>
  );
}
