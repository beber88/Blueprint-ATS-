import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/context";

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
    <html lang="he" dir="rtl">
      <body className="antialiased">
        <I18nProvider>
          {children}
          <Toaster position="top-left" richColors closeButton />
        </I18nProvider>
      </body>
    </html>
  );
}
