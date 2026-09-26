import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHeaderActions } from "@/components/auth-header-actions";
import { OnboardingSyncHint } from "@/components/onboarding-sync-hint";
import { AppSessionProvider } from "@/components/session-provider";
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <AppSessionProvider>
          <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 pb-3 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <p className="text-base font-semibold tracking-tight text-foreground">
                    Mind Your Language
                  </p>
                  <p className="text-sm text-muted-foreground">
                    From solid intermediate to natural fluency.
                  </p>
                </div>
                <AuthHeaderActions />
              </div>
              <OnboardingSyncHint />
            </div>
          </header>
          {children}
          <Toaster />
        </AppSessionProvider>
      </body>
    </html>
  );
}
