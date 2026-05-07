import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind",
  description: "Chat with PDFs and text files using retrieval-augmented generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
