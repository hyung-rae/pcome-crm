import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  test(`${width}px 직원 생성 모달·더보기 키보드·실패·크기`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => errors.push(request.url()));
    const staff = [{ id: "test-sub", name: "검증 직원", email: "ui@example.com", role: "sub_admin", is_active: true }, { id: "test-admin", name: "검증 관리자", email: "admin@example.com", role: "admin", is_active: true }];
    let creates = 0;
    let release: (() => void) | undefined;
    await page.route("**/api/staff", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { staff } });
      creates++;
      await new Promise<void>(resolve => { release = resolve; });
      await route.fulfill({ status: 503, json: { error: "생성 연결 실패" } });
    });
    await page.route("**/api/staff/test-sub", route => route.fulfill({ status: 503, json: { error: "수정 연결 실패" } }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/staff");
    const open = page.getByRole("button", { name: "서브관리자 생성", exact: true });
    await expect(page.getByRole("form", { name: "서브관리자 생성" })).toHaveCount(0);
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const form = dialog.getByRole("form");
    for (const control of await form.locator('.mantine-Input-input, button[type="submit"]').all()) {
      expect((await control.boundingBox())!.height).toBe(40);
    }
    expect((await dialog.getByRole("button", { name: "취소" }).boundingBox())!.height).toBe(40);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await form.locator('[name="name"]').fill("취소할 이름");
    await dialog.getByRole("button", { name: "취소" }).click();
    await open.click();
    await expect(form.locator('[name="name"]')).toHaveValue("");
    await dialog.getByRole("button", { name: "계정 생성" }).click();
    expect(creates).toBe(0);
    await form.locator('[name="name"]').fill("입력 유지");
    await form.locator('[name="email"]').fill("ui-new@example.com");
    await form.locator('[name="password"]').fill("Password123");
    await dialog.getByRole("button", { name: "계정 생성" }).click();
    await expect(dialog.getByRole("button", { name: "취소" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect.poll(() => creates).toBe(1);
    release!();
    await expect(dialog.getByRole("alert")).toHaveText("생성 연결 실패");
    await expect(form.locator('[name="name"]')).toHaveValue("입력 유지");
    await expect(form.locator('[name="password"]')).toHaveValue("Password123");
    await page.screenshot({ path: `test-results/staff-create-${width}.png`, fullPage: true });
    await dialog.getByRole("button", { name: "취소" }).click();
    const more = page.getByRole("button", { name: "검증 직원 관리 더보기" });
    await expect(page.getByRole("row").filter({ hasText: "admin@example.com" }).getByRole("button")).toHaveCount(0);
    await expect(more).not.toHaveText("더보기");
    expect((await more.boundingBox())!.width).toBe(32);
    expect((await more.locator("svg").boundingBox())!.width).toBe(16);
    await more.focus();
    await more.press("Enter");
    await expect(page.getByRole("menuitem")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await more.click();
    await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
    const menuBounds = (await page.getByRole("menu").boundingBox())!;
    expect(menuBounds.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/staff-menu-${width}.png`, fullPage: true });
    await page.getByRole("heading", { name: "직원 목록", exact: true }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await more.focus();
    await more.press("Enter");
    await expect(page.getByRole("menu").locator("[data-autofocus]")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "이름 수정", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveAccessibleName("직원 이름 수정");
    await expect(dialog.locator('[name="name"]')).toHaveValue("검증 직원");
    await dialog.locator('[name="name"]').fill("수정 유지");
    await dialog.getByRole("button", { name: "확인", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("수정 연결 실패");
    await expect(dialog.locator('[name="name"]')).toHaveValue("수정 유지");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
