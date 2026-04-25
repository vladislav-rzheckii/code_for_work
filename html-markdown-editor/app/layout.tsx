import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HTML - Markdown Online Editor",
  description: "HTML and Markdown online editor with preview"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
