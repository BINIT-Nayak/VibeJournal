import "server-only";
import { consumeRateLimit, type RateLimitScope } from "../rate-limit";

// Retain account-based throttling inside Auth.js, including direct credentials calls.
export async function allowAuthAttempt(scope: RateLimitScope, identifier: string) {
  return (await consumeRateLimit(scope, identifier)).allowed;
}
