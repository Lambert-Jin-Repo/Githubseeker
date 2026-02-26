import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearchStreamListener } from "@/components/shared/GlobalSearchStreamListener";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Scout — AI-Powered Repository Intelligence",
  description:
    "Discover, evaluate, and learn from open-source repositories with verified, AI-powered intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <GlobalSearchStreamListener />
        <div className="relative flex min-h-screen flex-col">
          {children}
        </div>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
