"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { credentialsSchema, type CredentialsInput } from "@/features/auth/schemas";

/** Shared foundation for future login/signup forms. */
export function useCredentialsForm() {
  return useForm<CredentialsInput>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });
}
