import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { deleteSubAdmin } from "../src/lib/auth/delete-staff";

test.use({ trace: "off" });

for (const stage of ["revoke", "missing", "remove", "success"] as const) {
  test(`삭제 단계 검증: ${stage}`, async () => {
    const calls: string[] = [];
    const result = deleteSubAdmin({
      revoke: async () => {
        calls.push("revoke");
        if (stage === "revoke") throw new Error("db");
        return stage !== "missing";
      },
      remove: async () => {
        calls.push("remove");
        if (stage === "remove") throw new Error("auth");
      },
    });
    if (stage === "success") await result;
    else
      await expect(result).rejects.toThrow(
        stage === "revoke"
          ? "삭제를 중단"
          : stage === "missing"
            ? "이미 삭제된"
            : "접근은 차단",
      );
    expect(calls).toEqual(
      stage === "revoke" || stage === "missing"
        ? ["revoke"]
        : ["revoke", "remove"],
    );
  });
}
for (const width of [1440, 768, 390]) {
  test(`${width}px 삭제 확인·취소·중복 제출·실패 안내`, async ({ page }) => {
    let deletes = 0,
      release: () => void = () => {};
    const unexpectedErrors: string[] = [];
    page.on("pageerror", error => unexpectedErrors.push(error.message));
    page.on("requestfailed", request => unexpectedErrors.push(request.url()));
    page.on("console", message => {
      if (message.type() === "error" && !message.text().includes("503")) unexpectedErrors.push(message.text());
    });
    await page.route("**/api/staff", (r) =>
      r.fulfill({
        json: {
          staff: [
            {
              id: "test-delete",
              name: "삭제 대상",
              email: "delete-ui@example.com",
              role: "sub_admin",
              is_active: true,
            },
          ],
        },
      }),
    );
    await page.route("**/api/staff/test-delete", async (r) => {
      deletes++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await r.fulfill({
        status: 503,
        json: {
          error:
            "계정 접근은 차단했으나 삭제에 실패했습니다. 다시 시도해주세요.",
        },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/staff");
    const more = page.getByRole("button", { name: "삭제 대상 관리 더보기" });
    await more.click();
    await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "서브관리자 삭제" });
    await expect(dialog).toContainText("삭제 대상 · delete-ui@example.com");
    await expect(dialog).toContainText("복구할 수 없습니다");
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).toBeHidden();
    expect(deletes).toBe(0);
    await expect(more).toBeFocused();
    await more.click();
    await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
    await dialog.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "삭제", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "취소" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect.poll(() => deletes).toBe(1);
    release();
    await expect(dialog.getByRole("alert")).toContainText("접근은 차단");
    expect(unexpectedErrors).toEqual([]);
    await page.screenshot({
      path: `/tmp/pcome-staff-delete-${width}.png`,
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).toBeHidden();
  });
}
test("삭제 성공 후 목록 갱신 실패를 구분한다", async ({ page }) => {
  let deleted = false;
  await page.route("**/api/staff", (r) =>
    !deleted
      ? r.fulfill({
          json: {
            staff: [
              {
                id: "test-delete",
                name: "삭제 대상",
                email: "delete-ui@example.com",
                role: "sub_admin",
                is_active: true,
              },
            ],
          },
        })
      : r.fulfill({ status: 503, json: { error: "목록 연결 실패" } }),
  );
  await page.route("**/api/staff/test-delete", (r) => {
    deleted = true;
    return r.fulfill({ json: { message: "계정을 삭제했습니다." } });
  });
  await page.goto("/admin/staff");
  await page.getByRole("button", { name: "삭제 대상 관리 더보기" }).click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: /완료/ })).toContainText("계정 삭제 완료");
  await expect(
    page.getByRole("region", { name: "직원 관리" }).getByRole("alert"),
  ).toContainText("계정은 삭제됐지만");
  await expect(
    page.getByRole("row").filter({ hasText: "delete-ui@example.com" }),
  ).toHaveCount(0);
});
test("실제 활성·비활성 계정 삭제와 API·기존 세션·DB 차단", async ({
  page,
  playwright,
  baseURL,
}) => {
  test.setTimeout(60000);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const ids: string[] = [],
    password = "Delete1!" + randomBytes(3).toString("hex");
  const headers = { origin: new URL(baseURL!).origin };
  const create = async (name: string, role = "sub_admin", active = true) => {
    const email = `pcome-e2e-delete-${randomBytes(6).toString("hex")}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    ids.push(id);
    expect(
      (
        await admin
          .from("staff")
          .insert({
            id,
            name,
            role,
            is_active: active,
            must_change_password: true,
          })
      ).error,
    ).toBeNull();
    return { id, email };
  };
  const sub = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: headers,
    storageState: { cookies: [], origins: [] },
  });
  const guest = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: headers,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const target = await create("삭제 검증"),
      other = await create("관리자 보호 검증", "admin"),
      inactive = await create("비활성 삭제 검증", "sub_admin", false);
    expect(
      (
        await sub.post("/api/auth/login", {
          data: { email: target.email, password },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await sub.delete(`/api/staff/${inactive.id}`, { data: {} })).status(),
    ).toBe(403);
    await admin
      .from("staff")
      .update({ must_change_password: false })
      .eq("id", target.id);
    expect(
      (await sub.delete(`/api/staff/${inactive.id}`, { data: {} })).status(),
    ).toBe(403);
    expect(
      (await guest.delete(`/api/staff/${target.id}`, { data: {} })).status(),
    ).toBe(401);
    const fixtures = JSON.parse(
      readFileSync(`${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/accounts.json`, "utf8"),
    );
    expect(
      (
        await page.request.delete(`/api/staff/${fixtures.admin.id}`, {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.delete(`/api/staff/${other.id}`, {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.delete("/api/staff/bad-id", { headers, data: {} })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.delete(`/api/staff/${randomUUID()}`, {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.delete(`/api/staff/${target.id}`, {
          headers: { origin: "https://invalid.example" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.delete(`/api/staff/${target.id}`, {
          headers: { ...headers, "content-type": "application/json" },
          data: "{",
        })
      ).status(),
    ).toBe(400);
    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await publicClient.auth.signInWithPassword({
      email: target.email,
      password,
    });
    expect((await publicClient.from("staff").select("id")).data?.length).toBe(
      1,
    );
    await page.goto("/admin/staff");
    const row = page.getByRole("row").filter({ hasText: target.email });
    await row.getByRole("button", { name: "삭제 검증 관리 더보기" }).click();
    await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "삭제", exact: true })
      .click();
    await expect(page.getByRole("status").filter({ hasText: /완료/ })).toContainText("계정 삭제 완료");
    await expect(row).toHaveCount(0);
    expect(
      (await admin.from("staff").select("id").eq("id", target.id)).data,
    ).toEqual([]);
    expect(
      (await admin.auth.admin.getUserById(target.id)).error,
    ).not.toBeNull();
    expect((await sub.post("/api/auth/password", { data: {} })).status()).toBe(
      401,
    );
    expect((await publicClient.from("staff").select("id")).data).toEqual([]);
    expect(
      (
        await guest.post("/api/auth/login", {
          data: { email: target.email, password },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.delete(`/api/staff/${target.id}`, {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.delete(`/api/staff/${inactive.id}`, {
          headers,
          data: {},
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await admin.auth.admin.getUserById(inactive.id)).error,
    ).not.toBeNull();
    expect(
      (await admin.from("staff").select("id").eq("id", inactive.id)).data,
    ).toEqual([]);
    expect(
      (await admin.from("staff").select("id").eq("id", other.id)).data?.length,
    ).toBe(1);
  } finally {
    await sub.dispose();
    await guest.dispose();
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
});
