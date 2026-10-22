import { addDays, seoulDateTime, weekdayLabel } from "./dates";
import type { ClassSession } from "./types";

export const UNASSIGNED_LABEL = "강사 미정";

type Counted = Pick<ClassSession, "starts_at" | "status" | "instructor_id" | "instructor_name">;
export type DayStat = { date: string; label: string; today: boolean; scheduled: number; cancelled: number };
export type InstructorStat = { name: string; scheduled: number; cancelled: number; total: number };

// Monday-first counts for the week starting at `week`, split into scheduled and cancelled.
export function countByWeekday(sessions: Counted[], week: string, today: string): DayStat[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week, index);
    return { date, label: weekdayLabel(date), today: date === today, scheduled: 0, cancelled: 0 };
  });
  for (const session of sessions) {
    const day = days.find((item) => item.date === seoulDateTime(session.starts_at).date);
    if (day) day[session.status] += 1;
  }
  return days;
}

// Per-instructor counts, busiest first then by name; sessions without an instructor share one row.
export function countByInstructor(sessions: Counted[]): InstructorStat[] {
  const rows = new Map<string, InstructorStat>();
  for (const session of sessions) {
    const key = session.instructor_id ?? "";
    const row = rows.get(key) ?? {
      name: session.instructor_id ? (session.instructor_name ?? UNASSIGNED_LABEL) : UNASSIGNED_LABEL,
      scheduled: 0,
      cancelled: 0,
      total: 0,
    };
    row[session.status] += 1;
    row.total += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ko"));
}
