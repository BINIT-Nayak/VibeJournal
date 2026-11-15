import { cookies } from "next/headers";
import { getAccountTheme } from "@/server/theme";
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
  const savedTheme = (await cookies()).get("vibejournal-theme")?.value;
  const theme = user ? await getAccountTheme(user.id) : savedTheme === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-screen">
        <Providers key={user?.id ?? "anonymous"} initialTheme={theme}>
          {user && <SyncQueueRunner key={user.id} userId={user.id} />}
          {children}
        </Providers>
      </body>
    </html>
  );
}
