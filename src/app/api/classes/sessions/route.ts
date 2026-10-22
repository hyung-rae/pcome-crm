import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { AppError } from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";
import { classRpc } from "@/lib/classes/rpc";
import { scheduleHorizon, seoulToday, startOfSeoulDay } from "@/lib/classes/dates";
import { rangeQuery, sessionCreateInput } from "@/lib/classes/validation";
import type { ClassColor } from "@/lib/classes/palette";
import type { ClassSession } from "@/lib/classes/types";

type Row = {
  id: string;
  series_id: string | null;
  occurrence_date: string | null;
  class_type_id: string;
  instructor_id: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: "scheduled" | "cancelled";
  is_modified: boolean;
  class_types: { name: string; color: ClassColor } | null;
  instructor: { name: string } | null;
  class_series: ClassSession["series"];
};

export async function GET(request: Request) {
  try {
    await requireStaff();
    const url = new URL(request.url);
    const range = rangeQuery(url.searchParams.get("from"), url.searchParams.get("to"));
    // Reads also keep open-ended series materialized one year ahead; a failure here must not
    // block viewing the schedule that already exists.
    await classRpc("class_extend_series").catch(() => undefined);
    const { data, error } = await createAdminClient()
      .from("class_sessions")
      .select(
        "id,series_id,occurrence_date,class_type_id,instructor_id,starts_at,ends_at,capacity,status,is_modified," +
          "class_types(name,color),instructor:staff!class_sessions_instructor_id_fkey(name)," +
          "class_series(weekdays,start_date,end_date,start_time,duration_minutes,capacity,instructor_id,class_type_id)",
      )
      .gte("starts_at", startOfSeoulDay(range.from))
      .lt("starts_at", startOfSeoulDay(range.toExclusive))
      .neq("status", "deleted")
      .order("starts_at")
      .returns<Row[]>();
    if (error) throw new AppError("수업 시간표를 불러오지 못했습니다.", 503);
    const now = Date.now();
    const today = seoulToday();
    return json({
      today,
      horizon: scheduleHorizon(today),
      sessions: data.map(({ class_types, instructor, class_series, ...row }) => ({
        ...row,
        type_name: class_types?.name ?? "",
        color: class_types?.color ?? "orange",
        instructor_name: instructor?.name ?? null,
        series: class_series,
        is_past: new Date(row.starts_at).getTime() <= now,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const { staff } = await requireStaff();
    const input = sessionCreateInput(body);
    const result = await classRpc("class_create", {
      p_actor: staff.id,
      p_class_type_id: input.class_type_id,
      p_instructor_id: input.instructor_id,
      p_capacity: input.capacity,
      p_duration_minutes: input.duration_minutes,
      p_start_time: input.start_time,
      p_date: input.date,
      p_weekdays: input.weekdays,
      p_end_date: input.end_date,
    });
    return json({ message: "수업을 등록했습니다.", id: result?.id }, 201);
  } catch (error) {
    return failure(error);
  }
}
