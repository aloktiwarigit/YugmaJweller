const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="10" fill="#f5eddd"/>
  <path d="M18 44h28M22 38h20M24 24a8 8 0 0 1 16 0c0 9-16 9-16 0Z" fill="none" stroke="#b98a2d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'image/svg+xml',
    },
  });
}
