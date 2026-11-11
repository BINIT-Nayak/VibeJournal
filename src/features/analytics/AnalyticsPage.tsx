"use client";

import { useRouter } from "next/navigation";
import { AppChrome } from "@/features/journal/components/AppChrome/AppChrome";
import { AnalyticsScreen } from "./AnalyticsScreen";

export function AnalyticsPage({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <AppChrome
      activeScreen="insights"
      darkMode={false}
      onNewEntry={() => router.push("/journal/new")}
      onScreenChange={(screen) =>
        router.push(
          screen === "insights"
            ? "/analytics"
            : screen === "journal"
              ? "/journal"
              : screen === "home"
                ? "/dashboard"
                : `/dashboard#${screen}`
        )
      }
    >
      <AnalyticsScreen userId={userId} />
    </AppChrome>
  );
}
