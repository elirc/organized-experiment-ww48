import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Newsreader } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const headingFont = Newsreader({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CRM Lead Pipeline",
  description: "Production-style CRM lead pipeline with ownership, follow-ups, notes, and activity logs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${monoFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[--color-background] font-[family-name:var(--font-body)] text-[--color-foreground]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
