"use client";

import { usePathname, useRouter } from "next/navigation";
import { AppChrome } from "../AppChrome/AppChrome";

export function JournalRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <AppChrome
      activeScreen={pathname === "/journal/new" ? "new" : "journal"}
      darkMode={false}
      onNewEntry={() => router.push("/journal/new")}
      onScreenChange={(screen) =>
        router.push(screen === "home" ? "/dashboard" : `/dashboard#${screen}`)
      }
    >
      {children}
    </AppChrome>
  );
}
