import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearchStreamListener } from "@/components/shared/GlobalSearchStreamListener";
import { MouseTracker } from "@/components/shared/MouseTracker";
import { KeyboardShortcutProvider } from "@/components/shared/KeyboardShortcutProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Git Scout — AI-Powered Repository Intelligence",
  description:
    "Discover, evaluate, and learn from open-source repositories with verified, AI-powered intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MouseTracker />
          <GlobalSearchStreamListener />
          <KeyboardShortcutProvider />
          <div className="relative flex min-h-screen flex-col z-10">
            {children}
          </div>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

