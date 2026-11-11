import { redirect } from "next/navigation";
import { AuthenticationPage } from "@/features/auth/components/AuthenticationPage";
import { getCurrentUser } from "@/server/auth/session";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthenticationPage />;
}
