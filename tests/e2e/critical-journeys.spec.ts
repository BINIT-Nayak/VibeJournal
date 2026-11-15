import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const db = new PrismaClient();
const emails: string[] = [];
test.afterEach(async () => {
  await db.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
});
test.afterAll(async () => {
  await db.$disconnect();
});
function account() {
  const email = `journey-${randomUUID()}@example.invalid`;
  emails.push(email);
  return { email, password: "JourneyPassword123!", name: "Journey test" };
}

test("register, write, edit, cancel deletion, then confirm deletion", async ({ page }) => {
  const user = account();
  await page.goto("/register");
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: /Create.*account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/journal/new");
  await page
    .getByLabel("Your reflection", { exact: true })
    .fill("A quiet walk helped me reflect today.");
  await page.getByRole("radio", { name: /7 out of 10/ }).check();
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByText("Synced — saved to your journal.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View saved entry", exact: true }).click();
  await expect(page).toHaveURL(/\/journal\/[^/?]+$/);
  const entryURL = page.url();
  await expect(
    page.getByText("A quiet walk helped me reflect today.", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: /Edit entry/ }).click();
  await page
    .getByLabel("Your reflection", { exact: true })
    .fill("An evening walk and a conversation helped today.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(entryURL);
  await page.reload();
  await expect(
    page.getByText("An evening walk and a conversation helped today.", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("An evening walk and a conversation helped today.", { exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Permanently delete entry", exact: true })
    .click();
  await expect(page).toHaveURL(/\/journal\?deleted=1/);
  await expect(
    page.getByText("An evening walk and a conversation helped today.", { exact: true })
  ).toHaveCount(0);
});

test("sign in, keep the selected theme across pages, then sign out of protected routes", async ({
  page,
  request,
}) => {
  const user = account();
  // API setup keeps this journey focused on login/session/theme rather than repeating registration UI.
  const response = await request.post("/api/auth/signup", {
    headers: { Origin: "http://127.0.0.1:3200" },
    data: user,
  });
  expect(response.status()).toBe(200);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/dashboard#profile");
  await expect(page.getByRole("button", { name: "Theme: Light", exact: true })).toBeVisible();
  const lightBackground = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole("button", { name: "Theme: Light", exact: true }).click();
  await expect(page.locator("body")).not.toHaveCSS("background-color", lightBackground);
  await expect(page.getByRole("button", { name: "Theme: Dark", exact: true })).toBeVisible();
  const darkBackground = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.goto("/journal");
  await expect(page.locator("body")).toHaveCSS("background-color", darkBackground);
  await page.reload();
  await expect(page.locator("body")).toHaveCSS("background-color", darkBackground);
  await page.goto("/dashboard#profile");
  await page.getByRole("button", { name: /Log out|Sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/journal/new");
  await expect(page).toHaveURL(/\/login/);
});

test("email changes require re-authentication and return to login", async ({ page }) => {
  const user = account();
  const changedEmail = `changed-${randomUUID()}@example.invalid`;
  emails.push(changedEmail);
  const response = await page.request.post("/api/auth/signup", {
    headers: { Origin: "http://127.0.0.1:3200" },
    data: user,
  });
  expect(response.status()).toBe(200);
  const denied = await page.request.patch("/api/settings", {
    headers: { Origin: "http://127.0.0.1:3200" },
    data: { email: changedEmail },
  });
  expect(denied.status()).toBe(401);
  await page.goto("/dashboard#profile");
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
  await page.getByLabel("Email address", { exact: true }).fill(changedEmail);
  await expect(page.getByLabel("Current password", { exact: true })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address", { exact: true }).fill(changedEmail);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
