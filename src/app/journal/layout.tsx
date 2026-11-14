import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { JournalRouteShell } from "@/features/journal/components/JournalPages/JournalRouteShell";

export default async function JournalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <JournalRouteShell>{children}</JournalRouteShell>;
}
