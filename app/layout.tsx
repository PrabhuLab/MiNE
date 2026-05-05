import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'MiNE - Mineral Network Explorer',
  description: 'Mineral Network Explorer',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="flex flex-col h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
