import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mind Your Language",
  description: "From solid intermediate to natural fluency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-0.5 px-4 py-3 sm:px-6">
            <p className="text-base font-semibold tracking-tight text-foreground">
              Mind Your Language
            </p>
            <p className="text-sm text-muted-foreground">
              From solid intermediate to natural fluency.
            </p>
          </div>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
