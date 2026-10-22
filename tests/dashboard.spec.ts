import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("대시보드는 빈 상태와 관리자 메뉴를 표시한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "대시보드." })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "아직 연결된 업무 데이터가 없습니다" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "관리자 관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "대시보드" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

for (const width of [1440, 768, 390]) {
  test(`${width}px에서 가로 넘침 없이 본문을 표시한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "워크스페이스 현황" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible({
      visible: width < 992,
    });
  });
}

test("모바일 메뉴는 키보드·닫기·배경으로 닫고 포커스를 반환한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const opener = page.getByRole("button", { name: "메뉴 열기" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "워크스페이스 메뉴" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "메뉴 닫기" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "대시보드" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "관리자 관리" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "메뉴 닫기" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "메뉴 닫기" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(360, 400);
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("페이지 로딩 중 콘솔·네트워크 오류가 없다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "워크스페이스 현황" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "대시보드" }).focus();
  expect(errors).toEqual([]);
});

test("PC LNB 접기·펼치기로 본문이 넓어지고 메뉴 이름은 유지된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const main = page.getByRole("main");
  const before = await main.boundingBox();
  const toggle = await page
    .getByRole("button", { name: "메뉴 접기", exact: true })
    .boundingBox();
  const menu = await page.getByRole("link", { name: "대시보드" }).boundingBox();
  expect(toggle!.y + toggle!.height).toBeLessThan(menu!.y);
  await page.getByRole("button", { name: "메뉴 접기" }).click();
  await expect(
    page.getByRole("button", { name: "메뉴 펼치기" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#desktop-lnb")).toHaveCSS("width", "88px");
  const expandButton = await page
    .getByRole("button", { name: "메뉴 펼치기", exact: true })
    .boundingBox();
  expect(expandButton!.x).toBe(toggle!.x);
  expect(expandButton!.y).toBe(toggle!.y);
  const lnbBox = (await page.locator("#desktop-lnb").boundingBox())!;
  const logoBox = (await page
    .locator('#desktop-lnb [aria-hidden="true"]')
    .filter({ hasText: "P" })
    .boundingBox())!;
  expect(
    Math.abs(logoBox.x + logoBox.width / 2 - (lnbBox.x + lnbBox.width / 2)),
  ).toBeLessThan(1);
  for (const item of [
    page.getByRole("link", { name: "대시보드" }),
    page.getByRole("link", { name: "관리자 관리" }),
  ]) {
    const box = (await item.boundingBox())!;
    expect(box.width).toBe(box.height);
    expect(
      Math.abs(box.x + box.width / 2 - (lnbBox.x + lnbBox.width / 2)),
    ).toBeLessThan(1);
  }
  const after = await main.boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width);
  await page.getByRole("link", { name: "대시보드" }).hover();
  await expect(page.getByRole("tooltip", { name: "대시보드" })).toBeVisible();
  await page.getByRole("button", { name: "메뉴 펼치기" }).click();
  await expect(page.getByRole("button", { name: "메뉴 접기" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("link", { name: "관리자 관리" })).toBeVisible();
});

test("모바일 메뉴가 완전히 열리면 브랜드 포인트가 유지된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const dialog = page.getByRole("dialog");
  await expect
    .poll(async () => Math.round((await dialog.boundingBox())?.x ?? -999))
    .toBe(0);
  const brandMark = dialog
    .locator('[aria-hidden="true"]')
    .filter({ hasText: "P" });
  await expect(brandMark).toHaveCSS("background-color", "rgb(242, 86, 52)");
});

test("모바일 닫기 버튼 hover에도 X 대비와 닫기 동작을 유지한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const close = page.getByRole("button", { name: "메뉴 닫기" });
  await close.hover();
  await expect(close).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(close).toHaveCSS("background-color", "rgb(51, 51, 51)");
  await close.click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeFocused();
});

test("LNB 애니메이션은 본문과 함께 움직이고 동작 줄이기 설정을 따른다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const lnb = page.locator("#desktop-lnb");
  await expect(lnb).toHaveCSS("transition-duration", "0.2s");
  await page.getByRole("button", { name: "메뉴 접기", exact: true }).click();
  await expect(lnb).toHaveCSS("width", "88px");
  await page.getByRole("button", { name: "메뉴 펼치기", exact: true }).click();
  await expect(lnb).toHaveCSS("width", "248px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(lnb).toHaveCSS("transition-duration", "0s");
});

test("앱 상단바·LNB·본문 경계는 맞물리고 본문만 스크롤된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto("/");
  const bar = page.getByRole("banner", { name: "앱 공통 상단바" });
  const before = await bar.boundingBox();
  const lnb = await page.locator("#desktop-lnb").boundingBox();
  const contentHeader = await page.getByRole("banner").last().boundingBox();
  expect(Math.abs(before!.y + before!.height - lnb!.y)).toBeLessThan(1);
  expect(Math.abs(before!.y + before!.height - contentHeader!.y)).toBeLessThan(
    1,
  );
  await page.getByRole("main").hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(async () => (await page.getByRole("main").boundingBox())!.y)
    .toBeLessThan(contentHeader!.y);
  expect(await bar.boundingBox()).toEqual(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
});

test("헤더 계정 조작과 브랜드 파비콘을 제공한다", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const bar = page.getByRole("banner", { name: "앱 공통 상단바" });
  await expect(bar.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
  await expect(bar).not.toContainText("WORKSPACE");
  await expect(bar.getByRole("link", { name: /비밀번호 변경/ })).toHaveAttribute("href", "/password");
  await expect(bar.getByRole("button", { name: "로그아웃", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그아웃", exact: true })).toHaveCount(1);
  const icon = page.locator('link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveCount(1);
  const response = await request.get((await icon.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("#F25634");
  expect((await request.get("/favicon.ico")).ok()).toBe(true);
});


for (const width of [1440, 768, 390]) {
  test(`${width}px 상단바 계정 배치·로그아웃 실패와 재시도`, async ({ page, baseURL }) => {
    await page.context().clearCookies();
    const accountData = JSON.parse(readFileSync(`${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/accounts.json`, "utf8")).admin;
    const login = await page.request.post("/api/auth/login", { headers: { origin: new URL(baseURL!).origin }, data: { email: accountData.email, password: accountData.password } });
    expect(login.ok()).toBe(true);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => {
      // Logout replace+refresh can cancel an obsolete login RSC navigation.
      if (new URL(request.url()).pathname === "/login" && request.failure()?.errorText === "net::ERR_ABORTED") return;
      errors.push(request.url());
    });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const bar = page.getByRole("banner", { name: "앱 공통 상단바" });
    const account = bar.getByRole("link", { name: /비밀번호 변경/ });
    const logout = bar.getByRole("button", { name: "로그아웃", exact: true });
    await expect(account).toContainText("검증 admin");
    expect((await bar.boundingBox())!.height).toBe(48);
    const title = (await bar.locator("span").filter({ hasText: /^PCOME CRM$/ }).boundingBox())!;
    const accountBox = (await account.boundingBox())!;
    const logoutBox = (await logout.boundingBox())!;
    expect(accountBox.x).toBeGreaterThanOrEqual(title.x + title.width);
    expect(logoutBox.x).toBeGreaterThanOrEqual(accountBox.x + accountBox.width);
    expect(logoutBox.x + logoutBox.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/account-header-${width}.png`, fullPage: true });
    let calls = 0;
    let release: (() => void) | undefined;
    await page.route("**/api/auth/logout", async route => {
      calls++;
      await new Promise<void>(resolve => { release = resolve; });
      await route.fulfill({ status: 503, json: { error: "연결 실패" } });
    });
    await logout.click();
    await expect(logout).toBeDisabled();
    await expect.poll(() => calls).toBe(1);
    release!();
    await expect(bar.getByRole("alert")).toHaveText("로그아웃을 다시 시도해주세요.");
    await expect(logout).toBeEnabled();
    expect(calls).toBe(1);
    await page.screenshot({ path: `test-results/account-error-${width}.png`, fullPage: true });
    await page.unroute("**/api/auth/logout");
    await logout.click();
    await expect(page).toHaveURL(/\/login$/);
    expect(errors).toEqual([]);
  });
}
