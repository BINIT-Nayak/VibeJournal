import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterPage } from "@/features/auth/components/RegisterPage/RegisterPage";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Create your account · VibeJournal",
  description: "Make room for how you feel. Create your private VibeJournal account.",
};

export default async function RegistrationPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <RegisterPage />;
}
