import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeJournal",
  description: "A private mood journal with gentle insights and music suggestions.",
  icons: {
    icon: "/favicon.svg",
  },
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
