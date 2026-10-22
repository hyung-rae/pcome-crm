import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });
function accounts() {
  return JSON.parse(
    readFileSync(`${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/accounts.json`, "utf8"),
  ) as Record<string, { id: string; email: string; password: string }>;
}
function origin(baseURL: string | undefined) {
  return { origin: new URL(baseURL!).origin };
}
async function login(
  request: APIRequestContext,
  baseURL: string | undefined,
  kind = "admin",
) {
  const account = accounts()[kind];
  const res = await request.post("/api/auth/login", {
    headers: origin(baseURL),
    data: { email: account.email, password: account.password },
  });
  expect(res.ok()).toBe(true);
  return res;
}
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test("비로그인 보호 화면·API 차단과 CSRF 검증", async ({ page, request }) => {
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/staff")).status()).toBe(401);
  expect((await request.post("/api/staff", { data: {} })).status()).toBe(403);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { origin: "https://invalid.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
});
for (const width of [1440, 768, 390]) {
  test(`${width}px 로그인 입력·반응형·콘솔 검증`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(request.url()));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "직원 로그인" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const email = page.locator(".mantine-TextInput-input");
    const passwordBox = page.locator(".mantine-PasswordInput-input");
    const toggle = page.getByRole("button", { name: "비밀번호 표시 전환" });
    const emailBounds = (await email.boundingBox())!;
    const passwordBounds = (await passwordBox.boundingBox())!;
    const iconBounds = (await toggle.locator("svg").boundingBox())!;
    const buttonBounds = (await page.getByRole("button", { name: "로그인", exact: true }).boundingBox())!;
    expect(emailBounds.width).toBe(passwordBounds.width);
    expect(emailBounds.height).toBe(passwordBounds.height);
    expect(emailBounds.height).toBe(40);
    expect(buttonBounds.height).toBe(40);
    expect(buttonBounds.width).toBe(emailBounds.width);
    expect(buttonBounds.x).toBe(emailBounds.x);
    expect(buttonBounds.height).toBeGreaterThanOrEqual(emailBounds.height);
    expect(buttonBounds.y - passwordBounds.y - passwordBounds.height).toBeGreaterThanOrEqual(24);
    await email.focus();
    await expect(email).toHaveCSS("outline-style", "none");
    await page.locator('input[name="password"]').focus();
    await expect(passwordBox).toHaveCSS("outline-style", "none");

    expect(Math.abs(iconBounds.y + iconBounds.height / 2 - passwordBounds.y - passwordBounds.height / 2)).toBeLessThan(1);
    await page.locator('input[name="password"]').fill("visibility-test");
    await toggle.click();
    await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "text");
    await toggle.press("Space");
    await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
    await expect(page.locator('input[name="password"]')).toHaveValue("visibility-test");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.locator('input[name="password"]').fill("invalid");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    expect(
      await page
        .locator('input[name="email"]')
        .evaluate((input: HTMLInputElement) => input.validity.typeMismatch),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/login-${width}.png`,
      fullPage: true,
    });
  });
}
test("잘못된 인증·프로필 없는 계정 거부", async ({ request, baseURL }) => {
  const account = accounts().admin;
  const failed = await request.post("/api/auth/login", {
    headers: origin(baseURL),
    data: { email: account.email, password: "incorrect-password" },
  });
  expect(failed.status()).toBe(401);
  const orphan = accounts().orphan;
  const denied = await request.post("/api/auth/login", {
    headers: origin(baseURL),
    data: { email: orphan.email, password: orphan.password },
  });
  expect(denied.status()).toBe(403);
});
test("초기 비밀번호 변경을 강제하고 현재 비밀번호·확인을 검증한다", async ({
  page,
  request,
  baseURL,
}) => {
  const account = accounts().initial;
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/password$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/password$/);
  expect((await page.request.get("/api/staff")).status()).toBe(403);
  const next = "Changed1!" + randomBytes(3).toString("hex");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const fields = page.locator(".mantine-PasswordInput-input");
    const submit = page.getByRole("button", { name: "비밀번호 변경", exact: true });
    const firstBounds = (await fields.first().boundingBox())!;
    const lastBounds = (await fields.last().boundingBox())!;
    const submitBounds = (await submit.boundingBox())!;
    expect(submitBounds.width).toBe(firstBounds.width);
    expect(submitBounds.height).toBe(40);
    expect(submitBounds.y - lastBounds.y - lastBounds.height).toBeGreaterThanOrEqual(24);
    for (const field of await fields.all()) {
      expect((await field.boundingBox())!.height).toBe(40);
      await field.locator("input").focus();
      await expect(field).toHaveCSS("outline-style", "none");
      const icon = (await field.locator("..").locator("svg").boundingBox())!;
      const box = (await field.boundingBox())!;
      expect(Math.abs(icon.y + icon.height / 2 - box.y - box.height / 2)).toBeLessThan(1);
    }
    await page.screenshot({
      path: `test-results/password-${width}.png`,
      fullPage: true,
    });
  }
  const headers = origin(baseURL);
  const same = await page.request.post("/api/auth/password", {
    headers,
    data: {
      currentPassword: account.password,
      password: account.password,
      confirmPassword: account.password,
    },
  });
  expect(same.status()).toBe(400);
  const mismatch = await page.request.post("/api/auth/password", {
    headers,
    data: {
      currentPassword: account.password,
      password: next,
      confirmPassword: next + "x",
    },
  });
  expect(mismatch.status()).toBe(400);
  const wrong = await page.request.post("/api/auth/password", {
    headers,
    data: {
      currentPassword: "wrong-password",
      password: next,
      confirmPassword: next,
    },
  });
  expect(wrong.status()).toBe(400);
  await page.locator('input[name="currentPassword"]').fill(account.password);
  await page.locator('input[name="password"]').fill(next);
  await page.locator('input[name="confirmPassword"]').fill(next);
  await page
    .getByRole("button", { name: "비밀번호 변경", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "대시보드." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "대시보드." })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "관리자 관리", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const old = await request.post("/api/auth/login", {
    headers,
    data: { email: account.email, password: account.password },
  });
  expect(old.status()).toBe(401);
  const fresh = await request.post("/api/auth/login", {
    headers,
    data: { email: account.email, password: next },
  });
  expect(fresh.ok()).toBe(true);
});
test("서브관리자 직접 DB·서버 권한 우회 차단", async ({ request, baseURL }) => {
  await login(request, baseURL, "sub");
  const admin = accounts().admin;
  expect((await request.get("/api/staff")).status()).toBe(403);
  expect(
    (
      await request.post("/api/staff", {
        headers: origin(baseURL),
        data: { name: "forged", role: "admin" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch(`/api/staff/${admin.id}`, {
        headers: origin(baseURL),
        data: { action: "status", is_active: false },
      })
    ).status(),
  ).toBe(403);
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const sub = accounts().sub;
  await c.auth.signInWithPassword({ email: sub.email, password: sub.password });
  const own = await c.from("staff").select("id");
  expect(own.error).toBeNull();
  expect(own.data?.map((x) => x.id)).toEqual([sub.id]);
  expect(
    (await c.from("staff").update({ role: "admin" }).eq("id", sub.id)).error
      ?.code,
  ).toBe("42501");
  expect(
    (
      await c
        .from("staff")
        .insert({ id: sub.id, role: "admin", name: "forged" })
    ).error?.code,
  ).toBe("42501");
  const remote = await c.from("staff").select("id").eq("id", admin.id);
  expect(remote.data).toEqual([]);
  await c.auth.signOut();
});
test("관리자 직원 생성·중복·수정·비활성·재활성·임시 비밀번호 재설정", async ({
  page,
  playwright,
  baseURL,
}) => {
  const account = accounts().admin;
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "관리자 관리", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "관리자 관리." }),
  ).toBeVisible();
  const email = `pcome-e2e-created-${randomBytes(8).toString("hex")}@example.com`,
    password = "Initial1!" + randomBytes(3).toString("hex");
  let createdId: string | undefined;
  const admin = adminClient(),
    headers = origin(baseURL);
  try {
    await page.getByRole("button", { name: "서브관리자 생성", exact: true }).click();
    const createForm = page.getByRole("form", { name: "서브관리자 생성" });
    await createForm.locator('input[name="name"]').fill("새 직원");
    await createForm.locator('input[name="email"]').fill(email);
    await createForm.locator('input[name="password"]').fill(password);
    await createForm.getByRole("button", { name: "계정 생성" }).click();
    await expect(page.getByRole("status").filter({ hasText: /완료/ })).toContainText(
      "계정 생성 완료",
    );
    const listing = await page.request.get("/api/staff");
    const rows = (await listing.json()).staff;
    createdId = rows.find((x: { email: string }) => x.email === email).id;
    const duplicate = await page.request.post("/api/staff", {
      headers,
      data: { name: "중복", email, password },
    });
    expect(duplicate.status()).toBe(409);
    const invalid = await page.request.post("/api/staff", {
      headers,
      data: { name: "", email: "bad", password: "short" },
    });
    expect(invalid.status()).toBe(400);
    const row = page.getByRole("row").filter({ hasText: email });
    await row.getByRole("button", { name: /관리 더보기/ }).click();
    await page.getByRole("menuitem", { name: "이름 수정", exact: true }).click();
    await page
      .getByRole("dialog")
      .locator('input[name="name"]')
      .fill("변경 직원");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "확인", exact: true })
      .click();
    await expect(row).toContainText("변경 직원");
    const sub = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: headers,
    });
    expect(
      (await sub.post("/api/auth/login", { data: { email, password } })).ok(),
    ).toBe(true);
    await row.getByRole("switch", { name: "변경 직원 활성 상태" }).click();
    await expect(row.getByRole("switch", { name: "변경 직원 활성 상태" })).not.toBeChecked();
    expect(
      (
        await sub.post("/api/auth/password", {
          data: {
            currentPassword: password,
            password: "Another1!pass",
            confirmPassword: "Another1!pass",
          },
        })
      ).status(),
    ).toBe(401);
    const c = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    await c.auth.signInWithPassword({ email, password });
    expect((await c.from("staff").select("id")).data).toEqual([]);
    await row.getByRole("switch", { name: "변경 직원 활성 상태" }).click();
    await expect(row.getByRole("switch", { name: "변경 직원 활성 상태" })).toBeChecked();
    expect(
      (await sub.post("/api/auth/login", { data: { email, password } })).ok(),
    ).toBe(true);
    const reset = "Reset1!" + randomBytes(3).toString("hex");
    await row.getByRole("button", { name: /관리 더보기/ }).click();
    await page.getByRole("menuitem", { name: "비밀번호 재설정", exact: true }).click();
    await page
      .getByRole("dialog")
      .locator('input[name="password"]')
      .fill(reset);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "확인", exact: true })
      .click();
    await expect(page.getByRole("status").filter({ hasText: /완료/ })).toContainText("비밀번호 재설정 완료");
    expect((await c.from("staff").select("id")).data).toEqual([]);
    expect(
      (
        await sub.post("/api/auth/password", {
          data: {
            currentPassword: password,
            password: "Another1!pass",
            confirmPassword: "Another1!pass",
          },
        })
      ).status(),
    ).toBe(401);
    const old = await sub.post("/api/auth/login", {
      data: { email, password },
    });
    expect(old.status()).toBe(401);
    const fresh = await sub.post("/api/auth/login", {
      data: { email, password: reset },
    });
    expect((await fresh.json()).redirect).toBe("/password");
    expect(
      (
        await page.request.patch(`/api/staff/${account.id}`, {
          headers,
          data: { action: "status", is_active: false },
        })
      ).status(),
    ).toBe(404);
    await sub.dispose();
    await c.auth.signOut();
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: "test-results/staff-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    if (createdId) {
      const { error } = await admin.auth.admin.deleteUser(createdId);
      expect(error).toBeNull();
    }
  }
});

test("로그인 연결 실패와 중복 제출을 처리한다", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/auth/login", async (route) => {
    requests++;
    // Keep the request pending while the form's duplicate-submission guard is checked.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "인증 서버에 연결할 수 없습니다." }),
    });
  });
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("connection-test@example.com");
  await page.locator('input[name="password"]').fill("invalid-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "로그인", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("form", { name: "로그인", exact: true }).getByRole("alert"),
  ).toContainText("인증 서버에 연결할 수 없습니다.");
  expect(requests).toBe(1);
  await expect(page).toHaveURL(/\/login$/);
});
test("로그아웃 후 복사해둔 세션도 DB·서버 요청을 차단한다", async ({
  request,
  playwright,
  baseURL,
}) => {
  await login(request, baseURL);
  const copied = await playwright.request.newContext({
    baseURL,
    storageState: await request.storageState(),
  });
  const state = await request.storageState();
  const response = await request.post("/api/auth/logout", {
    headers: origin(baseURL),
    data: {},
  });
  expect(response.ok()).toBe(true);
  expect((await copied.get("/api/staff")).status()).toBe(401);
  const broken = await playwright.request.newContext({
    baseURL,
    storageState: {
      ...state,
      cookies: state.cookies.map((cookie) => ({
        ...cookie,
        value: "invalid-expired-session",
      })),
    },
  });
  expect((await broken.get("/api/staff")).status()).toBe(401);
  await copied.dispose();
  await broken.dispose();
});

test("만료 시각에 도달한 쿠키 세션을 실제 Auth로 갱신한다", async ({
  request,
  playwright,
  baseURL,
}) => {
  await login(request, baseURL);
  const state = await request.storageState();
  const prefix = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
  const parts = state.cookies
    .filter((c) => c.name === prefix || c.name.startsWith(prefix + "."))
    .sort((a, b) => a.name.localeCompare(b.name));
  const read = (cookies: typeof parts) =>
    JSON.parse(
      Buffer.from(
        cookies
          .map((c) => c.value)
          .join("")
          .slice("base64-".length),
        "base64url",
      ).toString(),
    );
  const session = read(parts);
  // Simulate the SDK's local expiration threshold, preserving real signed tokens.
  session.expires_at = 1;
  const encoded =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const chunks = encoded.match(/.{1,3000}/g)!;
  const expired = chunks.map((value, index) => ({
    ...parts[0],
    name: chunks.length === 1 ? prefix : `${prefix}.${index}`,
    value,
  }));
  const refreshed = await playwright.request.newContext({
    baseURL,
    storageState: {
      ...state,
      cookies: [
        ...state.cookies.filter((c) => !parts.some((p) => p.name === c.name)),
        ...expired,
      ],
    },
  });
  const response = await refreshed.get("/api/staff");
  expect(response.ok()).toBe(true);
  const after = (await refreshed.storageState()).cookies
    .filter((c) => c.name === prefix || c.name.startsWith(prefix + "."))
    .sort((a, b) => a.name.localeCompare(b.name));
  expect(read(after).expires_at).toBeGreaterThan(Date.now() / 1000);
  await refreshed.dispose();
});
