import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  test(`${width}px 우측 하단 토스트·닫기 버튼 없음·자동 닫기`, async ({ page }) => {
    await page.clock.install();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", request => errors.push(request.url()));
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/staff", route => route.fulfill({ json: route.request().method() === "GET" ? { staff: [] } : { message: "서브관리자를 생성했습니다." } }));
    await page.goto("/admin/staff");
    const panel = page.getByRole("region", { name: "직원 관리" });
    await expect(panel.getByText("표시할 직원이 없습니다.")).toBeVisible();
    const initial = (await panel.boundingBox())!;
    const create = async () => {
      await page.getByRole("button", { name: "서브관리자 생성", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator('[name="name"]').fill("토스트 직원");
      await dialog.locator('[name="email"]').fill("toast@example.com");
      await dialog.locator('[name="password"]').fill("Password123");
      await dialog.getByRole("button", { name: "계정 생성", exact: true }).click();
      await expect(dialog).toHaveCount(0);
    };
    await create();
    const toast = page.getByRole("status").filter({ hasText: "계정 생성 완료" });
    const close = page.getByRole("button", { name: "알림 닫기" });
    await expect(toast).toBeVisible();
    await expect(panel.getByText("계정 생성 완료")).toHaveCount(0);
    await expect(close).toHaveCount(0);
    const box = (await toast.locator("..").boundingBox())!;
    expect(Math.abs(width - box.x - box.width - 16)).toBeLessThan(1);
    expect(Math.abs(900 - box.y - box.height - 16)).toBeLessThan(1);
    await expect(toast).toHaveCSS("white-space", "nowrap");
    expect(await toast.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(box.width).toBeGreaterThanOrEqual(Math.min(240, width - 32));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect.poll(async () => (await panel.boundingBox())!.height).toBe(initial.height);
    await page.screenshot({ path: `test-results/success-toast-${width}.png`, fullPage: true });
    await page.clock.fastForward(5100);
    await expect(toast).toHaveCount(0);
    await create();
    await expect(toast).toBeVisible();
    await toast.hover();
    await page.clock.fastForward(6000);
    await expect(toast).toBeVisible();
    await page.mouse.move(1, 800);
    await page.clock.fastForward(5100);
    await expect(toast).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
