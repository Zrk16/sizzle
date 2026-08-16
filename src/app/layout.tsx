import type { Metadata } from 'next';
import { Bodoni_Moda } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import { Nav } from '@/components/Nav';
import { SmoothScroll } from '@/components/SmoothScroll';
import './globals.css';

/**
 * Two faces, two voices. Bodoni is a Didone — the engraved-plaque letterform, which is
 * the entire award read and the one thing a grotesk cannot fake. Geist Mono carries every
 * label and number, so the chrome reads as a shooting script rather than as UI.
 */
const award = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-award',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'sizzle — the reel your repo deserves',
  description:
    'Paste a GitHub repo. An AI directs a short launch video from your real commits and real code, then renders it in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${award.variable} ${GeistMono.variable}`}>
      <body>
        <SmoothScroll />
        <Nav />
        {children}
      </body>
    </html>
  );
}
