import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TabBar } from '@/components/TabBar';

export const metadata: Metadata = {
  title: 'Coy · Discover',
  description: 'A swipe-based discovery tab built for the Coy SDE intern assignment.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ff2d78',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {/* Mobile-first: the app is a phone-width column, centred on desktop. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col sm:border-x-[2.5px] sm:border-ink">
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          <TabBar />
        </div>
      </body>
    </html>
  );
}
