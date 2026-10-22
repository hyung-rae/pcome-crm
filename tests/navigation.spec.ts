import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`${width}px 페이지 이동 효과 없이 기존 화면 유지 및 정상 전환`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => {
      // Next cancels obsolete RSC requests when committing the successful navigation.
      if (new URL(request.url()).pathname === "/admin/staff" && request.headers().rsc === "1" && request.failure()?.errorText === "net::ERR_ABORTED") return;
      errors.push(request.url());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const previous = page.getByRole("heading", { name: "대시보드." });
    await expect(previous).toBeVisible();
    let release: (() => void) | undefined;
    await page.route("**/admin/staff?*", async route => {
      await new Promise<void>(resolve => { release = resolve; });
      await route.continue();
    });
    if (width < 992) await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByRole("link", { name: "관리자 관리", exact: true }).click();
    const filter = page.getByRole("status", { name: "페이지 이동 중" });
    await expect.poll(() => !!release).toBe(true);
    await expect(filter).toHaveCount(0);
    await expect(previous).toBeVisible();
    await expect(page.getByText("화면을 불러오는 중입니다.")).toHaveCount(0);
    if (width === 1440) await page.screenshot({ path: "test-results/navigation-no-effect.png" });
    await expect.poll(() => !!release).toBe(true);
    release!();
    await expect(page.getByRole("heading", { name: "관리자 관리." })).toBeVisible();
    await expect(filter).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "워크스페이스 메뉴" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}


test("비밀번호 화면에서 대시보드 복귀에 이동 효과가 없다", async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route(url => url.pathname === "/" && url.searchParams.has("_rsc"), async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.continue();
  });
  await page.goto("/password");
  await page.getByRole("link", { name: "대시보드로", exact: true }).click();
  const filter = page.getByRole("status", { name: "페이지 이동 중" });
  await expect.poll(() => !!release).toBe(true);
  await expect(filter).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "비밀번호 변경" })).toBeAttached();
  await expect.poll(() => !!release).toBe(true);
  release!();
  await expect(page.getByRole("heading", { name: "대시보드." })).toBeVisible();
  await expect(filter).toHaveCount(0);
});
