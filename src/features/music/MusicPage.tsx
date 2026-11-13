"use client";
import { useRouter } from "next/navigation";
import { AppChrome } from "@/features/journal/components/AppChrome/AppChrome";
import { MusicRecommendationsPanel } from "./MusicRecommendationsPanel";
import styles from "./MusicPage.module.css";

export function MusicPage({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <AppChrome
      activeScreen="music"
      darkMode={false}
      onNewEntry={() => router.push("/journal/new")}
      onScreenChange={(screen) =>
        router.push(
          screen === "music"
            ? "/music"
            : screen === "insights"
              ? "/analytics"
              : screen === "journal"
                ? "/journal"
                : screen === "home"
                  ? "/dashboard"
                  : `/dashboard#${screen}`
        )
      }
    >
      <div className={styles.page}>
        <header>
          <p>A SOUNDTRACK, AT YOUR PACE</p>
          <h1>Music for your moment</h1>
          <p>
            Choose a direction and explore real catalog tracks. Your choice lasts for this app
            session; it is not saved to your account.
          </p>
        </header>
        <MusicRecommendationsPanel userId={userId} />
      </div>
    </AppChrome>
  );
}
