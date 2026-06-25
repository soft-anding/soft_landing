import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soft Landing - ניהול עברה לדירה חדשה",
  description: "עזרה בניהול התהליך של עברה לדירה חדשה בירושלים ובתל אביב",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col bg-surface-50 text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
