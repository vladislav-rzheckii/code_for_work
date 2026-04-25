import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HTML/Markdown EDITOR",
  description: "Minimal HTML and Markdown editor with preview"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
