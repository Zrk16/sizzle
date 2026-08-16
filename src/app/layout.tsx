import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import { Nav } from '@/components/Nav';
import { SmoothScroll } from '@/components/SmoothScroll';
import { Goo } from '@/components/Goo';
import './globals.css';

/**
 * Two faces, two voices. Archivo at 800-900 is heavy and round — it carries the same
 * weight as the molten wordmark instead of arguing with it. A Didone was tried here first
 * and read as a ceremony programme: correct for an awards conceit, wrong for a thing
 * called sizzle. Geist Mono carries every label and number, so the chrome stays technical.
 */
const display = Archivo({
  subsets: ['latin'],
  weight: ['600', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'sizzle — the reel your repo deserves',
  description:
    'Paste a GitHub repo. An AI directs a short launch video from your real commits and real code, then renders it in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${GeistMono.variable}`}>
      <body>
        <SmoothScroll />
        <Goo />
        <Nav />
        {children}
      </body>
    </html>
  );
}
