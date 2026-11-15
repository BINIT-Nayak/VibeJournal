import { afterEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { logServer } from "@/server/observability/logger";
import { observeRoute } from "@/server/observability/request";

afterEach(() => vi.restoreAllMocks());
describe("private server observability", () => {
  it("logs only safe metadata and returns a fresh correlation ID", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const secret = "private-journal-password-token-key-prompt";
    const handler = observeRoute("/api/journal", async () => {
      logServer({
        event: "auth.error",
        level: "error",
        password: secret,
        error: new Error(secret),
        prompt: secret,
      } as unknown as Parameters<typeof logServer>[0]);
      return Response.json({ content: secret }, { status: 201 });
    });
    const response = await handler(
      new Request(`https://example.test/api/journal?token=${secret}`, {
        method: "POST",
        body: secret,
        headers: { Authorization: `Bearer ${secret}`, "X-Request-ID": secret },
      })
    );
    const logs = output.mock.calls.map(([line]) => JSON.parse(line));
    expect(JSON.stringify(logs)).not.toContain(secret);
    expect(logs[1]).toMatchObject({
      route: "/api/journal",
      method: "POST",
      status: 201,
      event: "request.completed",
    });
    expect(logs[0].requestId).toBe(response.headers.get("X-Request-ID"));
    expect(logs[1].requestId).toBe(logs[0].requestId);
    expect(await response.json()).toEqual({ content: secret });
  });
  it("contains unexpected failures without serializing error messages or causes", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = observeRoute("/api/journal", async () => {
      throw new Error("secret SQL journal text", { cause: { token: "secret token" } });
    });
    const response = await handler(new Request("https://example.test/api/journal"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
    expect(JSON.stringify(output.mock.calls)).not.toContain("secret");
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({
      event: "request.failed",
      level: "error",
      status: 500,
    });
  });
  it("isolates simultaneous requests and observes handled errors", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = observeRoute("/api/journal", async () => {
      await Promise.resolve();
      logServer({ event: "redis.unavailable", level: "warn" });
      return new Response(null, { status: 429 });
    });
    const responses = await Promise.all([
      handler(new Request("https://example.test")),
      handler(new Request("https://example.test")),
    ]);
    const ids = responses.map((r) => r.headers.get("X-Request-ID"));
    expect(new Set(ids).size).toBe(2);
    const logs = output.mock.calls.map(([line]) => JSON.parse(line));
    for (const id of ids) {
      expect(logs.filter((l) => l.requestId === id)).toHaveLength(2);
      expect(logs.find((l) => l.requestId === id && l.status === 429)?.level).toBe("warn");
    }
  });
  it("preserves redirect responses and session cookies", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = observeRoute("/api/auth/login", async () => {
      const response = new Response(null, { status: 303, headers: { Location: "/dashboard" } });
      response.headers.append("Set-Cookie", "session=private; HttpOnly; Path=/");
      response.headers.append("Set-Cookie", "csrf=private; HttpOnly; Path=/");
      return response;
    });
    const response = await handler(new Request("https://example.test/api/auth/login"));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/dashboard");
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("X-Request-ID")).toBeTruthy();
  });
  it("preserves Next.js redirect control flow without logging private destinations", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = observeRoute("/api/auth/google", async () => redirect("/login?token=private"));
    await expect(handler(new Request("https://example.test/api/auth/google"))).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(output).not.toHaveBeenCalled();
  });
  it("rejects private text in allowed fields and tolerates output failures", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("sink failed");
    });
    logServer({
      event: "auth.error",
      level: "error",
      route: "/api/journal/private-text",
    } as unknown as Parameters<typeof logServer>[0]);
    expect(output).not.toHaveBeenCalled();
    expect(() => logServer({ event: "auth.error", level: "error" })).not.toThrow();
  });
});
