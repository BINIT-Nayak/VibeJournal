import { getCurrentUser } from "@/server/auth/session";
import { SyncQueueRunner } from "@/features/journal/sync/SyncQueueRunner";
import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "VibeJournal",
  description: "A private mood journal with gentle insights and music suggestions.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          {user && <SyncQueueRunner key={user.id} userId={user.id} />}
          {children}
        </Providers>
      </body>
    </html>
  );
}
