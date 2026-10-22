import { AppError } from "@/lib/auth/validation";
import { CLASS_COLORS, type ClassColor } from "./palette";
import {
  addDays,
  daysBetween,
  isDate,
  scheduleHorizon,
  seoulToday,
  timeToMinutes,
} from "./dates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const invalid = () => new AppError("입력 내용을 확인해주세요.");

export function classId(value: unknown) {
  if (typeof value !== "string" || !UUID.test(value))
    throw new AppError("잘못된 요청입니다.");
  return value;
}
function integer(value: unknown, min: number, max: number, step = 1) {
  const number = typeof value === "string" && value.trim() ? Number(value) : value;
  if (
    typeof number !== "number" ||
    !Number.isInteger(number) ||
    number < min ||
    number > max ||
    number % step !== 0
  )
    throw invalid();
  return number;
}
export function capacityField(value: unknown) {
  return integer(value, 1, 100);
}
export function durationField(value: unknown) {
  return integer(value, 10, 240, 5);
}
export function startTimeField(value: unknown) {
  if (typeof value !== "string" || !TIME.test(value) || timeToMinutes(value) % 5)
    throw new AppError("시작 시각은 5분 단위로 입력해주세요.");
  return value;
}
function sameDay(startTime: string, duration: number) {
  if (timeToMinutes(startTime) + duration > 24 * 60)
    throw new AppError("수업은 자정을 넘길 수 없습니다.");
}
function dateField(value: unknown) {
  if (!isDate(value)) throw new AppError("날짜를 확인해주세요.");
  return value;
}
function inRange(date: string, today: string) {
  if (date < today || date > scheduleHorizon(today))
    throw new AppError("오늘부터 1년 이내의 날짜만 등록할 수 있습니다.");
}
function endDateField(value: unknown, start: string) {
  if (value === null || value === undefined || value === "") return null;
  const end = dateField(value);
  if (end < start) throw new AppError("종료일은 시작일보다 빠를 수 없습니다.");
  return end;
}
function weekdaysField(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) throw invalid();
  const days = value.map((day) => integer(day, 1, 7));
  if (new Set(days).size !== days.length) throw invalid();
  return days.sort((a, b) => a - b);
}

export function classTypeInput(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 30)
    throw new AppError("수업 이름은 1~30자로 입력해주세요.");
  if (!CLASS_COLORS.includes(body.color as ClassColor)) throw invalid();
  return {
    name,
    default_capacity: capacityField(body.default_capacity),
    default_duration_minutes: durationField(body.default_duration_minutes),
    color: body.color as ClassColor,
  };
}

export function sessionCreateInput(body: Record<string, unknown>, today = seoulToday()) {
  const start_time = startTimeField(body.start_time);
  const duration_minutes = durationField(body.duration_minutes);
  sameDay(start_time, duration_minutes);
  const date = dateField(body.date);
  inRange(date, today);
  const repeat = body.repeat === true;
  return {
    class_type_id: classId(body.class_type_id),
    instructor_id: classId(body.instructor_id),
    capacity: capacityField(body.capacity),
    duration_minutes,
    start_time,
    date,
    weekdays: repeat ? weekdaysField(body.weekdays) : null,
    end_date: repeat ? endDateField(body.end_date, date) : null,
  };
}

export function sessionUpdateInput(body: Record<string, unknown>, today = seoulToday()) {
  const scope = body.scope === "following" ? "following" : body.scope === "one" ? "one" : null;
  if (!scope) throw invalid();
  const start_time = startTimeField(body.start_time);
  const duration_minutes = durationField(body.duration_minutes);
  sameDay(start_time, duration_minutes);
  const common = {
    scope,
    class_type_id: classId(body.class_type_id),
    instructor_id:
      body.instructor_id === null || body.instructor_id === "" ? null : classId(body.instructor_id),
    capacity: capacityField(body.capacity),
    duration_minutes,
    start_time,
  };
  if (scope === "one") {
    const date = dateField(body.date);
    inRange(date, today);
    return { ...common, date, weekdays: null, end_date: null };
  }
  // The split date comes from the selected session; the end date only needs to be a valid date here.
  return {
    ...common,
    date: null,
    weekdays: weekdaysField(body.weekdays),
    end_date: endDateField(body.end_date, today),
  };
}

export function scopeField(value: unknown) {
  if (value !== "one" && value !== "following") throw invalid();
  return value;
}

export function rangeQuery(from: string | null, to: string | null) {
  if (!isDate(from) || !isDate(to)) throw new AppError("조회 기간을 확인해주세요.");
  const span = daysBetween(from, to);
  if (span < 0 || span > 41) throw new AppError("조회 기간을 확인해주세요.");
  return { from, to, toExclusive: addDays(to, 1) };
}
