import { expect, test } from "@playwright/test";
import { countByInstructor, countByWeekday } from "../src/lib/classes/stats";

const session = (startsAt: string, status: "scheduled" | "cancelled", id: string | null, name: string | null) => ({
  starts_at: startsAt,
  status,
  instructor_id: id,
  instructor_name: name,
});

test("요일별 집계: 월~일 7칸, 정상·휴강 분리, 오늘 표시, 주 밖 회차 제외", () => {
  const days = countByWeekday(
    [
      session("2026-10-19T10:00:00+09:00", "scheduled", "a", "김요가"),
      session("2026-10-19T23:30:00+09:00", "cancelled", "a", "김요가"),
      session("2026-10-25T09:00:00+09:00", "scheduled", null, null),
      // 2026-10-25 15:30 UTC is already Monday 10-26 in Seoul, outside the week.
      session("2026-10-25T15:30:00Z", "scheduled", "a", "김요가"),
    ],
    "2026-10-19",
    "2026-10-22",
  );
  expect(days.map((day) => day.label)).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
  expect(days[0]).toMatchObject({ date: "2026-10-19", scheduled: 1, cancelled: 1, today: false });
  expect(days[3].today).toBe(true);
  expect(days[6]).toMatchObject({ scheduled: 1, cancelled: 0 });
  expect(days.reduce((sum, day) => sum + day.scheduled + day.cancelled, 0)).toBe(3);
  expect(countByWeekday([], "2026-10-19", "2026-10-22").every((day) => day.scheduled + day.cancelled === 0)).toBe(true);
});

test("강사별 집계: 많은 순·같으면 이름순, 강사 없음은 '강사 미정' 한 줄", () => {
  const rows = countByInstructor([
    session("2026-10-19T10:00:00+09:00", "scheduled", "b", "박필라"),
    session("2026-10-20T10:00:00+09:00", "scheduled", "a", "김요가"),
    session("2026-10-21T10:00:00+09:00", "cancelled", "a", "김요가"),
    session("2026-10-21T11:00:00+09:00", "scheduled", null, null),
    session("2026-10-22T11:00:00+09:00", "cancelled", null, null),
    session("2026-10-23T11:00:00+09:00", "scheduled", "c", "강스핀"),
  ]);
  expect(rows).toEqual([
    { name: "강사 미정", scheduled: 1, cancelled: 1, total: 2 },
    { name: "김요가", scheduled: 1, cancelled: 1, total: 2 },
    { name: "강스핀", scheduled: 1, cancelled: 0, total: 1 },
    { name: "박필라", scheduled: 1, cancelled: 0, total: 1 },
  ]);
  expect(countByInstructor([])).toEqual([]);
});
