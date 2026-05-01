export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-heading text-3xl text-ink">उत्पाद नहीं मिला</h1>
      <p className="font-body text-inkMute">यह उत्पाद उपलब्ध नहीं है।</p>
      <a
        href="/products"
        className="font-body text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        ← सभी उत्पाद देखें
      </a>
    </div>
  );
}
