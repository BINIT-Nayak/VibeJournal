import { beforeEach, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ requireUser: vi.fn(), generate: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireUser: dependencies.requireUser }));
vi.mock("@/server/weekly-reflection/service", () => ({
  generateWeeklyReflection: dependencies.generate,
  getWeeklyPreview: vi.fn(),
  WeeklyReflectionError: class extends Error {},
}));
vi.mock("@/server/rate-limit", () => ({
  RateLimitError: class extends Error {},
  rateLimitResponse: vi.fn(),
}));
import { POST } from "@/app/api/weekly-reflection/route";
beforeEach(() => {
  vi.clearAllMocks();
  dependencies.requireUser.mockResolvedValue({ id: "owner" });
});
it("returns 403 for invalid origins without generating a reflection", async () => {
  dependencies.requireUser.mockRejectedValue(new Error("Invalid request origin."));
  const response = await POST(
    new Request("https://example.test/api/weekly-reflection", { method: "POST", body: "{}" })
  );
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN");
  expect(dependencies.generate).not.toHaveBeenCalled();
});
it("returns 400 for malformed JSON without calling the provider", async () => {
  const response = await POST(
    new Request("https://example.test/api/weekly-reflection", { method: "POST", body: "{" })
  );
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  expect(dependencies.generate).not.toHaveBeenCalled();
});
