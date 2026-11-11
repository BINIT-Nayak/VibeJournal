import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginPage/LoginForm";
import { getCurrentUser } from "@/server/auth/session";
import { googleEnabled } from "@/server/auth/config";

export const metadata: Metadata = { title: "Sign in · VibeJournal" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <LoginForm googleEnabled={googleEnabled} />;
}
