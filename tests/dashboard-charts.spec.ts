import { expect, test } from "@playwright/test";
import { addDays, seoulDateTime, seoulToday, weekStart } from "../src/lib/classes/dates";
import { call, ClassFixture } from "./class-helpers";

test.use({ trace: "off" });

let fx: ClassFixture;
test.beforeEach(() => {
  fx = new ClassFixture();
});
test.afterEach(async () => {
  await fx.cleanup();
});

test("대시보드 이번 주 수업 현황: 강사별·요일별 표에 정상·휴강 수를 집계한다", async ({ page, request, baseURL }) => {
  // Sunday 21:00 and 22:00 of this week are still ahead unless the test runs late on Sunday.
  const sunday = addDays(weekStart(seoulToday()), 6);
  const now = seoulDateTime(new Date().toISOString());
  test.skip(now.date === sunday && now.time >= "20:50", "이번 주에 남은 시간이 없어 회차를 만들 수 없습니다.");
  const teacher = await fx.instructor();
  const type = await fx.type();
  for (const start of ["21:00", "22:00"]) {
    const created = await call(request, baseURL, "POST", "/api/classes/sessions", {
      class_type_id: type.id,
      instructor_id: teacher.id,
      capacity: 10,
      duration_minutes: 50,
      start_time: start,
      date: sunday,
    });
    expect(created.status).toBe(201);
  }
  const [first] = await fx.sessions({ type: type.id });
  expect((await call(request, baseURL, "PATCH", `/api/classes/sessions/${first.id}`, { action: "cancel", scope: "one" })).status).toBe(200);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "이번 주 수업 현황" })).toBeVisible();
  const byInstructor = page.getByRole("table", { name: "이번 주 강사별 담당 수업 수" });
  const row = byInstructor.getByRole("row", { name: new RegExp(`^${teacher.name} `) });
  await expect(row.getByRole("cell")).toHaveText(["1", "1"]);
  const sundayRow = page.getByRole("table", { name: "이번 주 요일별 수업 수" }).getByRole("row", { name: /^일/ });
  expect(Number(await sundayRow.getByRole("cell").last().textContent())).toBeGreaterThanOrEqual(1);
  // Zero-count days render empty bar groups, so look for at least one drawn bar.
  await expect
    .poll(() =>
      page.locator(".recharts-bar-rectangle path").evaluateAll((bars) =>
        bars.filter((bar) => bar.getBoundingClientRect().height > 0).length,
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "수업 시간표" }).last()).toHaveAttribute("href", "/classes");
  const shots = process.env.CLASS_SCREENSHOT_DIR;
  if (shots) {
    await page.waitForTimeout(800);
    await page.locator('section[aria-labelledby="overview-title"]').screenshot({ path: `${shots}/dashboard-charts-1440.png` });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(800);
    await page.locator('section[aria-labelledby="overview-title"]').screenshot({ path: `${shots}/dashboard-charts-390.png` });
  }
});
