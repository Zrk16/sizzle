import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import { Nav } from '@/components/Nav';
import { SmoothScroll } from '@/components/SmoothScroll';
import './globals.css';

/**
 * Two faces, two voices.
 *
 * Bricolage Grotesque carries the display. It has a variable optical-size axis and real
 * irregularity in the letterforms, which is the point: Archivo, Inter, Poppins and Space
 * Grotesk are the faces every generated site reaches for, and a heavy neutral grotesk with
 * tight tracking reads as AI on sight no matter what is set in it. A Didone was tried
 * before that and read as a ceremony programme.
 *
 * Geist Mono carries every label, number and index marker, so the chrome stays technical
 * against the display.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-display-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'sizzle',
  description:
    'Paste a GitHub repo. An AI directs a short launch video from your real commits and real code, then renders it in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${GeistMono.variable}`}>
      <body>
        <SmoothScroll />
        <Nav />
        {children}
      </body>
    </html>
  );
}
