import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/context";
import { ThemeProvider } from "@/lib/theme/context";
import { UserProvider } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Blueprint ATS",
  description: "Applicant Tracking System for HR teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('blueprint-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();` }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider>
            <UserProvider>
              {children}
              <Toaster position="top-left" richColors closeButton />
            </UserProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
