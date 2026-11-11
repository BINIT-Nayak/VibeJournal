import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { JournalRouteShell } from "@/features/journal/components/JournalPages/JournalRouteShell";

export default async function JournalLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentUser())) redirect("/login");
  return <JournalRouteShell>{children}</JournalRouteShell>;
}
