import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  test(`${width}px 목록 로딩·새로고침·권한 배지·상태 토글 성공과 실패`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => errors.push(request.url()));
    page.on("console", message => { if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) errors.push(message.text()); });
    const rows = [
      { id: "ui-sub", name: "토글 직원", email: "toggle@example.com", role: "sub_admin", is_active: true },
      { id: "ui-admin", name: "관리자", email: "admin@example.com", role: "admin", is_active: true },
    ];
    let getCount = 0;
    let pendingGets: (() => void)[] = [];
    const releaseGet = () => { pendingGets.forEach(resolve => resolve()); pendingGets = []; };
    let failGet = false;
    await page.route("**/api/staff", async route => {
      getCount++;
      await new Promise<void>(resolve => { pendingGets.push(resolve); });
      await route.fulfill(failGet ? { status: 503, json: { error: "조회 연결 실패" } } : { json: { staff: rows } });
    });
    let patches = 0;
    let failPatch = true;
    let releasePatch: (() => void) | undefined;
    await page.route("**/api/staff/ui-sub", async route => {
      patches++;
      expect(route.request().postDataJSON()).toEqual({ action: "status", is_active: false });
      await new Promise<void>(resolve => { releasePatch = resolve; });
      if (!failPatch) rows[0].is_active = false;
      await route.fulfill(failPatch ? { status: 503, json: { error: "상태 연결 실패" } } : { json: { message: "변경 성공" } });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/staff");
    const refresh = page.getByRole("button", { name: "목록 새로고침", exact: true });
    await expect(page.getByRole("status", { name: "직원 정보를 불러오는 중입니다." })).toBeVisible();
    await expect(refresh).toBeDisabled();
    await page.screenshot({ path: `test-results/staff-skeleton-${width}.png`, fullPage: true });
    await expect.poll(() => getCount).toBeGreaterThan(0);
    const initialGets = getCount;
    releaseGet();
    const row = page.getByRole("row").filter({ hasText: "toggle@example.com" });
    const admin = page.getByRole("row").filter({ hasText: "admin@example.com" });
    const toggle = row.getByRole("switch", { name: "토글 직원 활성 상태" });
    await expect(toggle).toBeChecked();
    await expect(admin.getByRole("switch")).toHaveCount(0);
    const badge = row.getByText("서브관리자", { exact: true });
    await expect(badge).toHaveCSS("background-color", "rgb(240, 240, 242)");
    await expect(admin.getByText("관리자", { exact: true }).last()).toHaveCSS("background-color", "rgb(255, 240, 235)");
    await expect(refresh).not.toHaveText("목록 새로고침");
    expect((await refresh.locator("svg").boundingBox())!.width).toBe(16);
    await refresh.click();
    await expect.poll(() => getCount).toBe(initialGets + 1);
    await expect(refresh).toBeDisabled();
    await expect(toggle).toBeDisabled();
    await expect(row).toBeVisible();
    await expect(page.getByText("직원 목록을 갱신하는 중입니다.")).toBeVisible();
    failGet = true;
    releaseGet();
    await expect(page.getByRole("region", { name: "직원 관리" }).getByRole("alert")).toContainText("조회 연결 실패");
    await expect(row).toBeVisible();
    await expect(refresh).toBeEnabled();
    await toggle.focus();
    await toggle.press("Space");
    await expect.poll(() => patches).toBe(1);
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeDisabled();
    await expect(row.getByRole("button", { name: /더보기/ })).toBeDisabled();
    await expect(refresh).toBeDisabled();
    releasePatch!();
    await expect(row.getByRole("alert")).toContainText("상태 연결 실패");
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeEnabled();
    await page.screenshot({ path: `test-results/staff-toggle-error-${width}.png`, fullPage: true });
    failPatch = false;
    await toggle.click();
    await expect.poll(() => patches).toBe(2);
    releasePatch!();
    await expect.poll(() => getCount).toBe(initialGets + 2);
    await expect(toggle).not.toBeChecked();
    releaseGet();
    await expect(page.getByRole("region", { name: "직원 관리" }).getByRole("alert")).toContainText("상태는 변경됐지만 목록 갱신에 실패");
    await expect(toggle).not.toBeChecked();
    failGet = false;
    await refresh.click();
    await expect.poll(() => getCount).toBe(initialGets + 3);
    releaseGet();
    await expect(refresh).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await row.getByRole("button", { name: /더보기/ }).click();
    await expect(page.getByRole("menuitem")).toHaveCount(4);
    await expect(page.getByRole("menuitem", { name: "강사 지정" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /비활성화|재활성화/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/staff-controls-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("최초 조회 실패는 빈 목록과 구분하며 재시도할 수 있다", async ({ page }) => {
  let fail = true;
  await page.route("**/api/staff", route => route.fulfill(fail ? { status: 503, json: { error: "조회 실패" } } : { json: { staff: [] } }));
  await page.goto("/admin/staff");
  await expect(page.getByRole("region", { name: "직원 관리" }).getByRole("alert")).toContainText("조회 실패");
  await expect(page.getByText("표시할 직원이 없습니다.")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "목록 새로고침" }).click();
  await expect(page.getByText("표시할 직원이 없습니다.")).toBeVisible();
  await expect(page.getByRole("region", { name: "직원 관리" }).getByRole("alert")).toHaveCount(0);
});



test("조회 오류 후 생성 성공으로 복구하면 이전 조회 오류가 해제된다", async ({ page }) => {
  let fail = true;
  await page.route("**/api/staff", route => {
    if (route.request().method() === "POST") {
      fail = false;
      return route.fulfill({ json: { message: "서브관리자를 생성했습니다." } });
    }
    return route.fulfill(fail ? { status: 503, json: { error: "이전 조회 실패" } } : { json: { staff: [] } });
  });
  await page.goto("/admin/staff");
  const panel = page.getByRole("region", { name: "직원 관리" });
  await expect(panel.getByRole("alert")).toContainText("이전 조회 실패");
  await page.getByRole("button", { name: "서브관리자 생성", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="name"]').fill("복구 직원");
  await dialog.locator('[name="email"]').fill("recover@example.com");
  await dialog.locator('[name="password"]').fill("Password123");
  await dialog.getByRole("button", { name: "계정 생성" }).click();
  await expect(panel.getByText("표시할 직원이 없습니다.")).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});
