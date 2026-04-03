import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AI CRM — Agentic Insight Dashboard",
  description:
    "AI CRM: Query your data with natural language. AI-powered, privacy-first analytics dashboard built with Multi-Agent Agentic workflows.",
  keywords: ["AI", "CRM", "dashboard", "analytics", "natural language", "SQLite", "data visualization"],
};

import { ThemeProvider } from "@/components/ThemeProvider";
import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={`${outfit.variable} font-outfit antialiased overflow-x-hidden`}>
        <ThemeProvider>
          <div className="grid grid-cols-[auto_1fr] min-h-screen bg-[var(--bg-base)]">
            <Sidebar />
            <main className="relative flex flex-col min-w-0">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
