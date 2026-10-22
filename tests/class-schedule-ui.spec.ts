import { expect, test, type Page } from "@playwright/test";
import { addDays, daysBetween, seoulToday, shortDate, weekStart } from "../src/lib/classes/dates";
import { call, ClassFixture, futureMonday } from "./class-helpers";

test.use({ trace: "off" });
const SHOTS = process.env.CLASS_SCREENSHOT_DIR;

let fx: ClassFixture;
test.beforeEach(() => {
  fx = new ClassFixture();
});
test.afterEach(async () => {
  await fx.cleanup();
});

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // Expected 4xx responses (e.g. conflicts) are logged by the browser as failed resources.
    if (message.type() === "error" && !/status of 4\d\d/.test(message.text())) errors.push(message.text());
  });
  return errors;
}
async function goToWeek(page: Page, monday: string) {
  const weeks = daysBetween(weekStart(seoulToday()), monday) / 7;
  for (let index = 0; index < weeks; index++) {
    await expect(page.getByRole("button", { name: "다음 주" })).toBeEnabled();
    await page.getByRole("button", { name: "다음 주" }).click();
  }
  await expect(page.getByText(`${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`)).toBeVisible();
}

test("1440px 수업 종류 등록 → 반복 수업 등록 → 그리드 표시 → 휴강·필터", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const teacher = await fx.instructor();
  const name = `스피닝 ${fx.tag}`;
  const monday = futureMonday();
  await page.goto("/classes");
  await expect(page.getByRole("link", { name: "수업 시간표" })).toHaveAttribute("aria-current", "page");
  // The current week opens scrolled to now: the time pill is inside the grid viewport (only while now is within the grid range).
  const pill = page.locator('[class*="nowPill"]');
  await expect(page.getByRole("group", { name: "주간 시간표 그리드" })).toBeVisible();
  if (await pill.count()) {
    const viewport = (await page.getByRole("group", { name: "주간 시간표 그리드" }).locator("..").boundingBox())!;
    await expect.poll(async () => {
      const box = (await pill.boundingBox())!;
      return box.y >= viewport.y && box.y + box.height <= viewport.y + viewport.height;
    }).toBe(true);
  }

  await page.getByRole("tab", { name: "수업 종류" }).click();
  await page.getByRole("button", { name: "수업 종류 추가" }).click();
  const typeForm = page.getByRole("dialog", { name: "수업 종류 추가" });
  await typeForm.getByLabel("이름").fill(name);
  await typeForm.getByText("15명", { exact: true }).click();
  await typeForm.getByText("45분", { exact: true }).click();
  await typeForm.getByText("블루", { exact: true }).click();
  await typeForm.getByRole("button", { name: "추가" }).click();
  await expect(page.getByRole("status").filter({ hasText: "수업 종류 등록 완료" })).toBeVisible();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "시간표" }).click();
  await page.getByRole("button", { name: "수업 추가" }).click();
  const form = page.getByRole("dialog", { name: "수업 추가" });
  await form.getByLabel("수업 종류").click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(form.getByRole("radio", { name: "45분" })).toBeChecked();
  await form.getByLabel("강사").click();
  await page.getByRole("option", { name: teacher.name }).click();
  await form.getByText("매주 반복").click();
  await form.getByLabel("시작일").fill(monday);
  await expect(form.getByRole("checkbox", { name: "월" })).toBeChecked();
  await form.getByText("수", { exact: true }).click();
  await expect(form.getByRole("checkbox", { name: "수" })).toBeChecked();
  await form.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("status").filter({ hasText: "수업 등록 완료" })).toBeVisible();

  await goToWeek(page, monday);
  const blocks = page.getByRole("button", { name: new RegExp(`^${name} `) });
  await expect(blocks).toHaveCount(2);
  const grid = await page.getByRole("group", { name: "주간 시간표 그리드" }).boundingBox();
  const block = await blocks.first().boundingBox();
  expect(block!.x).toBeGreaterThan(grid!.x);
  expect(block!.y + block!.height).toBeLessThanOrEqual(grid!.y + grid!.height);
  await blocks.first().hover();
  const tip = page.getByRole("tooltip").filter({ hasText: "정원" });
  await expect(tip).toContainText(`강사 ${teacher.name}`);
  await expect(tip).toContainText("정원 15명");
  // Only the grid scrolls: the workspace fits the viewport and the weekday row stays put.
  const scroller = page.getByRole("group", { name: "주간 시간표 그리드" }).locator("..");
  await expect
    .poll(() => page.locator("#main-content").evaluate((main) => main.parentElement!.scrollHeight - main.parentElement!.clientHeight))
    .toBeLessThanOrEqual(1);
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const weekdayRow = page.getByRole("group", { name: "주간 시간표 그리드" }).locator("> div").nth(1);
  const headerBefore = (await weekdayRow.boundingBox())!.y;
  await scroller.evaluate((element) => (element.scrollTop = 300));
  expect((await weekdayRow.boundingBox())!.y).toBeCloseTo(headerBefore, 0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/classes-1440.png`, fullPage: true });

  await blocks.first().click();
  const detail = page.getByRole("dialog", { name });
  await expect(detail.getByText("매주 월·수 · 종료일 없음")).toBeVisible();
  await detail.getByRole("button", { name: "휴강", exact: true }).click();
  await detail.getByLabel("이 회차만").check();
  await detail.getByRole("button", { name: "휴강", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "휴강 처리 완료" })).toBeVisible();
  await expect(blocks.first()).toHaveAccessibleName(/휴강$/);
  await expect(blocks.nth(1)).not.toHaveAccessibleName(/휴강$/);

  await page.getByRole("combobox", { name: "강사 필터" }).click();
  await page.getByRole("option", { name: "강사 미정" }).click();
  await expect(blocks).toHaveCount(0);
  await expect(page.getByText("필터 조건에 맞는 수업이 없습니다.")).toBeVisible();
  await page.getByRole("combobox", { name: "강사 필터" }).click();
  await page.getByRole("option", { name: teacher.name }).click();
  await expect(blocks).toHaveCount(2);
  await page.getByRole("button", { name: "오늘" }).click();
  await expect(page.getByText(`${shortDate(weekStart(seoulToday()))} –`)).toBeVisible();
  expect(errors).toEqual([]);
});

test("겹치는 수업 등록 시 모달 안에 겹치는 일정 안내", async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const type = await fx.type();
  const teacher = await fx.instructor();
  const date = addDays(futureMonday(), 1);
  await call(request, baseURL, "POST", "/api/classes/sessions", {
    class_type_id: type.id, instructor_id: teacher.id, capacity: 20, duration_minutes: 50, start_time: "19:00", date,
  });
  await page.goto("/classes");
  await page.getByRole("button", { name: "수업 추가" }).click();
  const form = page.getByRole("dialog", { name: "수업 추가" });
  await form.getByLabel("수업 종류").click();
  await page.getByRole("option", { name: type.name, exact: true }).click();
  await form.getByLabel("강사").click();
  await page.getByRole("option", { name: teacher.name }).click();
  await form.getByLabel("날짜").fill(date);
  await form.getByLabel("시작 시각").fill("19:30");
  await form.getByRole("button", { name: "저장" }).click();
  await expect(form.getByRole("alert")).toContainText("시간이 겹칩니다");
  await expect(form.getByRole("list", { name: "겹치는 수업 1건" })).toContainText(`19:00–19:50 ${type.name}`);
  await expect(form).toBeVisible();
});

test("이후 전체 수정 폼은 개별 수정한 회차가 아니라 반복 규칙 값으로 시작한다", async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const type = await fx.type();
  const teacher = await fx.instructor();
  const monday = futureMonday();
  const created = await call(request, baseURL, "POST", "/api/classes/sessions", {
    class_type_id: type.id, instructor_id: teacher.id, capacity: 20, duration_minutes: 50, start_time: "19:00", date: monday, repeat: true, weekdays: [1], end_date: addDays(monday, 21),
  });
  const first = (await fx.sessions({ series: created.body.id }))[0];
  await call(request, baseURL, "PATCH", `/api/classes/sessions/${first.id}`, {
    action: "update", scope: "one", class_type_id: type.id, instructor_id: teacher.id, capacity: 12, duration_minutes: 30, start_time: "20:00", date: monday,
  });
  await page.goto("/classes");
  await goToWeek(page, monday);
  await page.getByRole("button", { name: new RegExp(`^${type.name} `) }).click();
  const detail = page.getByRole("dialog", { name: type.name });
  await expect(detail.getByText("이 회차만 수정됨", { exact: false })).toBeVisible();
  await detail.getByRole("button", { name: "수정" }).click();
  await detail.getByLabel("이 회차 이후 전체").check();
  await detail.getByRole("button", { name: "다음" }).click();
  const form = page.getByRole("dialog", { name: "반복 수업 수정 · 이후 전체" });
  await expect(form.getByLabel("시작 시각")).toHaveValue("19:00");
  await expect(form.getByRole("radio", { name: "50분" })).toBeChecked();
  await expect(form.getByRole("radio", { name: "20명" })).toBeChecked();
  await expect(form.getByLabel("종료일")).toHaveValue(addDays(monday, 21));
});

for (const width of [768, 390]) {
  test(`${width}px 시간표 표시와 지난 회차 조회 전용`, async ({ page, request, baseURL }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width, height: 900 });
    const type = await fx.type();
    const teacher = await fx.instructor();
    const monday = futureMonday();
    await call(request, baseURL, "POST", "/api/classes/sessions", {
      class_type_id: type.id, instructor_id: teacher.id, capacity: 18, duration_minutes: 50, start_time: "07:00", date: monday, repeat: true, weekdays: [1, 5],
    });
    const past = await fx.admin
      .from("class_sessions")
      .insert({
        class_type_id: type.id,
        instructor_id: teacher.id,
        starts_at: new Date(Date.now() - 20 * 60_000).toISOString(),
        ends_at: new Date(Date.now() - 10 * 60_000).toISOString(),
        capacity: 10,
      })
      .select("id")
      .single();
    expect(past.error).toBeNull();

    await page.goto("/classes");
    const sessions = page.getByRole("button", { name: new RegExp(`^${type.name} `) });
    await expect(sessions).toHaveCount(1);
    await sessions.first().click();
    const detail = page.getByRole("dialog", { name: type.name });
    await expect(detail.getByText("이미 시작했거나 지난 수업은 조회만 할 수 있습니다.")).toBeVisible();
    await expect(detail.getByRole("button", { name: "수정" })).toHaveCount(0);
    await detail.getByRole("button", { name: "창 닫기" }).click();

    await goToWeek(page, monday);
    await expect(sessions).toHaveCount(2);
    if (width === 768) await expect(page.getByRole("group", { name: "주간 시간표 그리드" })).toBeVisible();
    else {
      await expect(page.getByRole("group", { name: "주간 시간표 그리드" })).toHaveCount(0);
      await expect(page.getByRole("region", { name: `${shortDate(addDays(monday, 1))} 화요일` }).getByText("수업 없음")).toBeVisible();
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(scroll).toBeLessThanOrEqual(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/classes-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("직원 관리: 강사 배지·지정·해제 경고, 비활성화 경고 취소, 강사 미정 표시", async ({ page, request, baseURL }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const type = await fx.type();
  const teacher = await fx.instructor();
  const other = await fx.instructor();
  const plain = await fx.instructor({ instructor: false });
  const monday = futureMonday();
  for (const [id, time] of [[teacher.id, "19:00"], [other.id, "20:00"]])
    await call(request, baseURL, "POST", "/api/classes/sessions", {
      class_type_id: type.id, instructor_id: id, capacity: 20, duration_minutes: 50, start_time: time, date: monday,
    });

  await page.goto("/admin/staff");
  const row = (name: string) => page.getByRole("row").filter({ hasText: name });
  await expect(row(teacher.name).getByText("강사", { exact: true })).toBeVisible();
  await expect(row(plain.name).getByLabel("강사 아님")).toBeVisible();

  await page.getByRole("button", { name: `${plain.name} 관리 더보기` }).click();
  await page.getByRole("menuitem", { name: "강사 지정" }).click();
  await expect(page.getByRole("status").filter({ hasText: "강사 지정 완료" })).toBeVisible();
  await expect(row(plain.name).getByText("강사", { exact: true })).toBeVisible();

  await page.getByRole("switch", { name: `${other.name} 활성 상태` }).click({ force: true });
  const deactivate = page.getByRole("dialog", { name: "서브관리자 비활성화" });
  await expect(deactivate.getByText("앞으로 맡은 수업 1회가 '강사 미정'으로 바뀝니다.", { exact: false })).toBeVisible();
  await deactivate.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("switch", { name: `${other.name} 활성 상태` })).toBeChecked();

  await page.getByRole("button", { name: `${teacher.name} 관리 더보기` }).click();
  await page.getByRole("menuitem", { name: "강사 해제" }).click();
  const release = page.getByRole("dialog", { name: "강사 해제" });
  await expect(release.getByText("앞으로 맡은 수업 1회", { exact: false })).toBeVisible();
  await release.getByRole("button", { name: "강사 해제" }).click();
  await expect(page.getByRole("status").filter({ hasText: "강사 해제 완료" })).toBeVisible();
  await expect(row(teacher.name).getByLabel("강사 아님")).toBeVisible();

  await page.getByRole("link", { name: "수업 시간표" }).click();
  await goToWeek(page, monday);
  await expect(page.getByRole("button", { name: new RegExp(`^${type.name} .* 19:00–19:50 강사 미정`) })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`^${type.name} .* 20:00–20:50 ${other.name}`) })).toBeVisible();
  expect(errors).toEqual([]);
});
