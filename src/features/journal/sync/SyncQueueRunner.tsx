"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearLocalAccountData } from "../drafts/storage";
import { replayQueue } from "./queue";

export function SyncQueueRunner({ userId }: { userId: string }) {
  const client = useQueryClient();
  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("vibejournal-account") : null;
    if (channel)
      channel.onmessage = (event) => {
        if (event.data?.type === "deleted" && event.data.userId === userId) {
          client.clear();
          void clearLocalAccountData(userId).finally(() =>
            window.location.replace("/login?accountDeleted=1")
          );
        }
      };
    const run = () => {
      void replayQueue(userId).catch(() => {
        // Storage remains the authority; an inaccessible DB must never claim sync.
      });
    };
    const invalidate = () => {
      for (const name of ["journal-history", "dashboard", "analytics"])
        void client.invalidateQueries({ queryKey: [name, userId] });
    };
    run();
    const timer = setInterval(run, 15000);
    window.addEventListener("online", run);
    window.addEventListener("vibejournal-sync-queued", run);
    window.addEventListener("vibejournal-synced", invalidate);
    return () => {
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("vibejournal-sync-queued", run);
      window.removeEventListener("vibejournal-synced", invalidate);
    };
  }, [userId, client]);
  return null;
}
