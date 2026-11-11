import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters."),
});

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().max(100).optional(),
});

export const registrationFormSchema = registerSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(1, "Tell us what you'd like to be called.")
      .max(100, "Use 100 characters or fewer."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Your passwords don't match yet.",
    path: ["confirmPassword"],
  });

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type CredentialsInput = z.infer<typeof credentialsSchema>;
