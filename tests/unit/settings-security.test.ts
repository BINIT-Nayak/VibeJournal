import { beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findUnique: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  enforceRateLimit: vi.fn(),
  persistSettings: vi.fn(),
  listEntries: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ requireUser: dependencies.requireUser }));
vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: dependencies.findUnique },
    userSettings: { upsert: dependencies.upsert },
  },
}));
vi.mock("@/server/auth/password", () => ({
  verifyPassword: dependencies.verifyPassword,
  hashPassword: dependencies.hashPassword,
}));
vi.mock("@/server/audit/service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/rate-limit", () => ({
  enforceRateLimit: dependencies.enforceRateLimit,
  RateLimitError: class extends Error {},
  rateLimitResponse: vi.fn(),
}));
vi.mock("@/server/auth/settings-repository", () => ({
  persistSettings: dependencies.persistSettings,
  AccountChangedError: class extends Error {},
}));
vi.mock("@/server/journal/service", () => ({ listEntries: dependencies.listEntries }));
import { RateLimitError } from "@/server/rate-limit";
import { PATCH } from "@/server/auth/routes/settings/route";
import { currentUserPayload } from "@/server/auth/current-user";
const user = { id: "owner", email: "owner@example.invalid", name: null };
const settings = {
  favoriteGenres: [],
  dislikedGenres: [],
  preferredLanguages: [],
  allowExplicit: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  dependencies.requireUser.mockResolvedValue(user);
  dependencies.findUnique.mockResolvedValue({ ...user, passwordHash: "existing" });
  dependencies.verifyPassword.mockResolvedValue(true);
  dependencies.persistSettings.mockResolvedValue({ user, settings });
  dependencies.upsert.mockResolvedValue(settings);
});
const patch = (body: unknown) =>
  PATCH(
    new Request("https://example.test/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  );
describe("account-change security", () => {
  it("requires current password for an email change, but not an unchanged email", async () => {
    expect((await patch({ email: "changed@example.invalid" })).status).toBe(401);
    expect(dependencies.persistSettings).not.toHaveBeenCalled();
    expect((await patch({ email: user.email, name: "Updated" })).status).toBe(200);
  });
  it("throttles verification before checking the password", async () => {
    dependencies.enforceRateLimit.mockRejectedValue(new Error("unavailable"));
    expect(
      (await patch({ currentPassword: "password", newPassword: "NewPassword123" })).status
    ).toBe(500);
    expect(dependencies.enforceRateLimit).toHaveBeenCalledWith("account-change", user.id);
    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
    expect(dependencies.persistSettings).not.toHaveBeenCalled();
  });
  it("returns 429 when the account-change attempt limit is reached", async () => {
    dependencies.enforceRateLimit.mockRejectedValue(new RateLimitError(900));
    const { rateLimitResponse } = await import("@/server/rate-limit");
    vi.mocked(rateLimitResponse).mockReturnValue(
      Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "900" } }
      )
    );
    const response = await patch({ currentPassword: "wrong", newPassword: "NewPassword123" });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(dependencies.verifyPassword).not.toHaveBeenCalled();
  });
  it("rejects wrong passwords and OAuth email changes", async () => {
    dependencies.verifyPassword.mockResolvedValue(false);
    expect(
      (await patch({ email: "changed@example.invalid", currentPassword: "wrong" })).status
    ).toBe(401);
    dependencies.findUnique.mockResolvedValue({ ...user, passwordHash: null });
    expect(
      (await patch({ email: "changed@example.invalid", currentPassword: "wrong" })).status
    ).toBe(400);
    expect(dependencies.persistSettings).not.toHaveBeenCalled();
  });
  it("does not decrypt journals to construct the login response", async () => {
    dependencies.listEntries.mockRejectedValue(new Error("key unavailable"));
    expect(await currentUserPayload(user, false)).toMatchObject({ user, entries: [] });
    expect(dependencies.listEntries).not.toHaveBeenCalled();
  });
});
