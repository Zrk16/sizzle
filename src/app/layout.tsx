import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'sizzle — a launch video for your repo',
  description:
    'Paste a GitHub repo. An AI directs a short launch video from your real commits and real code, and renders it in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
