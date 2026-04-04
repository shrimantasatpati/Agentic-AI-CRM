import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'AI CRM — Agentic Workflows',
  description: 'Production-ready CRM powered by multi-agent AI architecture. Automate lead qualification, email intelligence, sales pipeline, customer success, and more.',
  keywords: ['CRM', 'AI agents', 'sales automation', 'lead qualification', 'customer success'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Sidebar />
        <main className="main-content page-enter">
          {children}
        </main>
      </body>
    </html>
  );
}
