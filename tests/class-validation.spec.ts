import { expect, test } from "@playwright/test";
import {
  addYear,
  isoWeekday,
  scheduleHorizon,
  seoulDateTime,
  seoulToday,
  weekStart,
} from "../src/lib/classes/dates";
import {
  classTypeInput,
  rangeQuery,
  sessionCreateInput,
  sessionUpdateInput,
} from "../src/lib/classes/validation";

const ID = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-10-22";
const base = {
  class_type_id: ID,
  instructor_id: ID,
  capacity: 20,
  duration_minutes: 50,
  start_time: "19:00",
  date: TODAY,
};

test("서울 날짜·요일·주 시작 계산", () => {
  expect(seoulToday(new Date("2026-10-21T15:00:00Z"))).toBe("2026-10-22");
  expect(seoulToday(new Date("2026-10-21T14:59:59Z"))).toBe("2026-10-21");
  expect(isoWeekday("2026-10-25")).toBe(7);
  expect(weekStart("2026-10-25")).toBe("2026-10-19");
  expect(weekStart("2026-10-19")).toBe("2026-10-19");
  expect(seoulDateTime("2026-10-22T10:00:00Z")).toEqual({ date: "2026-10-22", time: "19:00" });
});

test("1년 범위는 Postgres 날짜 계산과 같다", () => {
  expect(scheduleHorizon(TODAY)).toBe("2027-10-22");
  expect(addYear("2028-02-29")).toBe("2029-02-28");
});

test("등록 날짜 범위 경계: 오늘~1년 허용, 어제·1년+1일 거부", () => {
  expect(sessionCreateInput(base, TODAY).date).toBe(TODAY);
  expect(sessionCreateInput({ ...base, date: "2027-10-22" }, TODAY).date).toBe("2027-10-22");
  expect(() => sessionCreateInput({ ...base, date: "2026-10-21" }, TODAY)).toThrow("1년 이내");
  expect(() => sessionCreateInput({ ...base, date: "2027-10-23" }, TODAY)).toThrow("1년 이내");
  expect(() => sessionCreateInput({ ...base, date: "2026-02-30" }, TODAY)).toThrow();
});

test("시간·정원·소요시간 경계", () => {
  expect(sessionCreateInput({ ...base, start_time: "23:00", duration_minutes: 60 }, TODAY).start_time).toBe("23:00");
  expect(() => sessionCreateInput({ ...base, start_time: "23:30", duration_minutes: 60 }, TODAY)).toThrow("자정");
  expect(() => sessionCreateInput({ ...base, start_time: "19:03" }, TODAY)).toThrow("5분");
  for (const duration_minutes of [5, 12, 245]) expect(() => sessionCreateInput({ ...base, duration_minutes }, TODAY)).toThrow();
  for (const capacity of [0, 101, 1.5]) expect(() => sessionCreateInput({ ...base, capacity }, TODAY)).toThrow();
  expect(sessionCreateInput({ ...base, capacity: "100", duration_minutes: "240", start_time: "06:00" }, TODAY).capacity).toBe(100);
});

test("반복 요일·종료일 검증", () => {
  const repeat = sessionCreateInput({ ...base, repeat: true, weekdays: [3, 1], end_date: "" }, TODAY);
  expect(repeat.weekdays).toEqual([1, 3]);
  expect(repeat.end_date).toBeNull();
  expect(sessionCreateInput(base, TODAY).weekdays).toBeNull();
  for (const weekdays of [[], [0], [8], [1, 1]])
    expect(() => sessionCreateInput({ ...base, repeat: true, weekdays }, TODAY)).toThrow();
  expect(() => sessionCreateInput({ ...base, repeat: true, weekdays: [1], end_date: "2026-10-21" }, TODAY)).toThrow("종료일");
});

test("수정 입력: 범위·강사 미정 허용", () => {
  const one = sessionUpdateInput({ ...base, scope: "one", instructor_id: null }, TODAY);
  expect(one.instructor_id).toBeNull();
  const following = sessionUpdateInput({ ...base, scope: "following", weekdays: [2], end_date: null }, TODAY);
  expect(following.date).toBeNull();
  expect(() => sessionUpdateInput({ ...base, scope: "all" }, TODAY)).toThrow();
  expect(() => sessionUpdateInput({ ...base, scope: "one", instructor_id: "x" }, TODAY)).toThrow();
});

test("수업 종류 입력 검증", () => {
  expect(classTypeInput({ name: "  요가 ", default_capacity: 20, default_duration_minutes: 50, color: "teal" }).name).toBe("요가");
  expect(() => classTypeInput({ name: " ", default_capacity: 20, default_duration_minutes: 50, color: "teal" })).toThrow();
  expect(() => classTypeInput({ name: "가".repeat(31), default_capacity: 20, default_duration_minutes: 50, color: "teal" })).toThrow();
  expect(() => classTypeInput({ name: "요가", default_capacity: 20, default_duration_minutes: 50, color: "black" })).toThrow();
});

test("조회 기간은 최대 42일", () => {
  expect(rangeQuery("2026-10-19", "2026-10-25").toExclusive).toBe("2026-10-26");
  expect(() => rangeQuery("2026-10-19", "2026-11-30")).toThrow();
  expect(() => rangeQuery("2026-10-25", "2026-10-19")).toThrow();
  expect(() => rangeQuery(null, "2026-10-19")).toThrow();
});
