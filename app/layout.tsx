import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css'; // Global styles
import { CitationFooter } from '@/components/CitationFooter';

export const metadata: Metadata = {
  title: 'MiNE - Mineral Network Explorer',
  description: 'Mineral Network Explorer',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen" suppressHydrationWarning>
        <main className="min-h-0 flex-1">{children}</main>
        <CitationFooter />
        {/* Cloudflare Web Analytics */}
        <Script
          type="module"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token":"6d007adc05d847a581f00afde2925924"}'
          strategy="afterInteractive"
        />
        {/* End Cloudflare Web Analytics */}
      </body>
    </html>
  );
}
