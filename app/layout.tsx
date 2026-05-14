import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/context";
import { ThemeProvider } from "@/lib/theme/context";
import { UserProvider } from "@/lib/auth/context";
import { ConvexClientProvider } from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Blueprint HR",
  description: "HR System - Blueprint Building Group Inc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1A1A1A" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('blueprint-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();` }} />
      </head>
      <body className="antialiased">
        <ConvexClientProvider>
          <ThemeProvider>
            <I18nProvider>
              <UserProvider>
                {children}
                <Toaster position="top-left" richColors closeButton />
              </UserProvider>
            </I18nProvider>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
