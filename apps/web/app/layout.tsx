import type { Metadata } from "next";
import {
  Commissioner,
  Crimson_Pro,
  Source_Code_Pro,
} from "next/font/google";
import { AppShell } from "@/components/app-shell/app-shell";
import { CloudPersistence } from "@/components/cloud-persistence";
import { AppSessionProvider } from "@/components/session-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const displayFont = Crimson_Pro({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600"],
});

const sansFont = Commissioner({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const monoFont = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500"],
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
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppSessionProvider>
          <CloudPersistence />
          <AppShell>{children}</AppShell>
          <Toaster />
        </AppSessionProvider>
      </body>
    </html>
  );
}
