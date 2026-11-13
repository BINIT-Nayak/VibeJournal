import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { MusicPage } from "@/features/music/MusicPage";
export const metadata = { title: "Music · VibeJournal" };
export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <MusicPage userId={user.id} />;
}
